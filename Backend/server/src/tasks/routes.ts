import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { insertRow, updateRow } from '../crud.js';
import { isUuid } from '../files/routes.js';
import { route } from '../http.js';
import { date, editionFilter, fieldError, one, parse, requireEdition, text, uuid, whereBuilder } from '../validate.js';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;

const fields = {
  edition_id: uuid('Choose an edition.'),
  title: z.string().trim().min(1, 'Enter what needs doing.').max(300),
  notes: text,
  due_date: date.nullable(),
  status: z.enum(TASK_STATUSES, { message: 'Choose a status.' }),
  assignee_id: uuid('Choose an active member of staff.').nullable(),
};
// A task stays with its edition
const taskPatch = z.object(fields).omit({ edition_id: true }).partial();
const taskCreate = z.object(fields).partial().extend({ edition_id: fields.edition_id, title: fields.title });

const TASK_SQL = `select t.id, t.edition_id, e.name as edition_name, t.title, t.notes, t.due_date::text as due_date, t.status,
  t.assignee_id, u.full_name as assignee_name, t.completed_at, t.created_at
  from tasks t join editions e on e.id = t.edition_id left join users u on u.id = t.assignee_id`;
const MISSING = 'That task was not found.';

async function assertAssignee(tx: Db, assigneeId: string | null | undefined) {
  if (assigneeId && !(await tx.query('select 1 from users where id = $1 and active', [assigneeId])).length) {
    throw fieldError('assignee_id', 'Choose an active member of staff.');
  }
}

// The planning checklist of an edition. Everyone can read it; admin and the events team keep it.
export function taskRoutes(ctx: AppContext) {
  const router = Router();
  const read = requirePermission('tasks.read');
  const write = requirePermission('tasks.write');

  // ?edition_id= ?status= ?assignee=<id or "me">; unfinished first, then by due date
  router.get(
    '/',
    read,
    route(async (req, res) => {
      const w = whereBuilder();
      const editionId = editionFilter(req.query);
      if (editionId) w.add('t.edition_id = ?', editionId);
      if (typeof req.query.status === 'string' && (TASK_STATUSES as readonly string[]).includes(req.query.status)) w.add('t.status = ?', req.query.status);
      const assignee = req.query.assignee === 'me' ? currentUser(res).id : req.query.assignee;
      if (typeof assignee === 'string' && isUuid(assignee)) w.add('t.assignee_id = ?', assignee);
      res.json(await ctx.db.query(`${TASK_SQL} ${w.sql} order by (t.status = 'done'), t.due_date nulls last, t.created_at, t.id`, w.params));
    }),
  );

  router.get('/:id', read, route(async (req, res) => res.json(await one(ctx.db, TASK_SQL, 't', req.params.id, MISSING))));

  router.post(
    '/',
    write,
    route(async (req, res) => {
      const body = parse(taskCreate, req.body);
      const now = ctx.now();
      const id = await ctx.db.transaction(async (tx) => {
        await requireEdition(tx, body.edition_id);
        await assertAssignee(tx, body.assignee_id);
        const newId = await insertRow(tx, 'tasks', {
          ...body,
          completed_at: body.status === 'done' ? now : undefined,
          created_by: currentUser(res).id,
          created_at: now,
          updated_at: now,
        });
        await recordActivity(tx, { actorId: currentUser(res).id, entity: 'tasks', entityId: newId, action: 'create', changes: { title: body.title, edition_id: body.edition_id }, at: now });
        return newId;
      });
      res.status(201).json(await one(ctx.db, TASK_SQL, 't', id, MISSING));
    }),
  );

  router.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const patch = parse(taskPatch, req.body);
      const before = await one(ctx.db, TASK_SQL, 't', req.params.id, MISSING);
      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        await assertAssignee(tx, patch.assignee_id);
        const changes = diff(before, patch);
        if (!Object.keys(changes).length) return;
        // The finish time follows the status
        const completed_at = patch.status === undefined || patch.status === before.status ? undefined : patch.status === 'done' ? now : null;
        await updateRow(tx, 'tasks', req.params.id, { ...patch, completed_at, updated_at: now });
        await recordActivity(tx, { actorId: currentUser(res).id, entity: 'tasks', entityId: req.params.id, action: 'update', changes, at: now });
      });
      res.json(await one(ctx.db, TASK_SQL, 't', req.params.id, MISSING));
    }),
  );

  router.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, TASK_SQL, 't', req.params.id, MISSING);
      await ctx.db.transaction(async (tx) => {
        await tx.query('delete from tasks where id = $1', [req.params.id]);
        await recordActivity(tx, { actorId: currentUser(res).id, entity: 'tasks', entityId: req.params.id, action: 'delete', changes: { title: before.title }, at: ctx.now() });
      });
      res.status(204).end();
    }),
  );

  return router;
}
