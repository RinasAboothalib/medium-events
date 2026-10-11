import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { insertRow, pageOf, updateRow } from '../crud.js';
import { isUuid } from '../files/routes.js';
import { HttpError, route, validationError } from '../http.js';
import { PERMISSIONS } from '../permissions.js';

const ASSIGNEE_MESSAGE = 'Choose an active admin or member of the sales team.';

export const SOURCES = ['website', 'whatsapp', 'phone', 'email', 'walk_in', 'other'] as const;
export const STATUSES = ['new', 'contacted', 'proposal_sent', 'won', 'lost'] as const;
const PAGE_SIZE = 50;

const text = z.string().trim().max(5000);
const email = z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address.')]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31.');
const id = (message: string) => z.string().regex(/^[0-9a-f-]{36}$/i, message).nullable();

const fields = {
  full_name: z.string().trim().min(1, "Enter the person's name.").max(200),
  company: text,
  email,
  phone: text,
  service: text,
  event: text,
  timeline: text,
  budget: text,
  message: text,
  source: z.enum(SOURCES, { message: 'Choose where the enquiry came from.' }),
  status: z.enum(STATUSES, { message: 'Choose a status.' }),
  assignee_id: id(ASSIGNEE_MESSAGE),
  edition_id: id('Choose an edition.'),
};
const patchBody = z.object(fields).partial();
const createBody = patchBody.extend({ full_name: fields.full_name, source: fields.source });
const noteBody = z.object({ body: z.string().trim().min(1, 'Write a note.').max(5000) });
const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  source: z.enum(SOURCES).optional(),
  assignee: z.string().regex(/^[0-9a-f-]{36}$/i).optional(),
  q: z.string().trim().max(200).optional(),
  from: date.optional(),
  to: date.optional(),
});

export const ENQUIRY_SQL = `select q.id, q.created_at, q.full_name, q.company, q.email, q.phone, q.service, q.event, q.timeline, q.budget, q.message,
  q.source, q.status, q.assignee_id, u.full_name as assignee_name, q.edition_id, e.name as edition_name,
  (select n.body from enquiry_notes n where n.enquiry_id = q.id order by n.created_at desc limit 1) as latest_note
  from enquiries q left join users u on u.id = q.assignee_id left join editions e on e.id = q.edition_id`;

// Builds the where clause shared by the list and the enquiries report; dates are Maldives calendar days
export function enquiryFilters(query: unknown) {
  const parsed = listQuery.safeParse(query);
  if (!parsed.success) throw validationError(parsed.error);
  const f = parsed.data;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (f.status) add('q.status = ?', f.status);
  if (f.source) add('q.source = ?', f.source);
  if (f.assignee) add('q.assignee_id = ?', f.assignee);
  if (f.q) add("(q.full_name ilike ? or q.company ilike ? or q.email ilike ? or q.phone ilike ?)", `%${f.q.replace(/[%_\\]/g, '\\$&')}%`);
  if (f.from) add('q.created_at >= ?::timestamptz', `${f.from}T00:00:00+05:00`);
  if (f.to) add("q.created_at < (?::timestamptz + interval '1 day')", `${f.to}T00:00:00+05:00`);
  return { where: where.length ? `where ${where.join(' and ')}` : '', params };
}

async function assertRefs(tx: Db, e: { assignee_id?: string | null; edition_id?: string | null }) {
  // Only people who can open enquiries can be given one
  const handlers = PERMISSIONS['enquiries.access'] as string[];
  if (e.assignee_id && !(await tx.query('select 1 from users where id = $1 and active and role = any($2)', [e.assignee_id, handlers])).length) {
    throw new HttpError(400, 'Check the highlighted fields.', { assignee_id: ASSIGNEE_MESSAGE });
  }
  if (e.edition_id && !(await tx.query('select 1 from editions where id = $1', [e.edition_id])).length) {
    throw new HttpError(400, 'Check the highlighted fields.', { edition_id: 'Choose an edition.' });
  }
}

export async function getEnquiry(db: Db, enquiryId: string) {
  const [row] = isUuid(enquiryId) ? await db.query<Record<string, unknown>>(`${ENQUIRY_SQL} where q.id = $1`, [enquiryId]) : [];
  if (!row) throw new HttpError(404, 'That enquiry was not found.');
  return row;
}

// Leads: website enquiries and ones staff enter by hand. Admin and sales only.
export function enquiryRoutes(ctx: AppContext) {
  const router = Router();
  router.use(requirePermission('enquiries.access'));

  router.get(
    '/',
    route(async (req, res) => {
      const { where, params } = enquiryFilters(req.query);
      const page = pageOf(req.query.page);
      const [{ total }] = await ctx.db.query<{ total: number }>(`select count(*)::int as total from enquiries q ${where}`, params);
      const rows = await ctx.db.query(`${ENQUIRY_SQL} ${where} order by q.created_at desc, q.id limit ${PAGE_SIZE} offset ${page * PAGE_SIZE}`, params);
      res.json({ rows, total });
    }),
  );

  router.get(
    '/:id',
    route(async (req, res) => {
      const enquiry = await getEnquiry(ctx.db, req.params.id);
      const notes = await ctx.db.query(
        `select n.id, u.full_name as author_name, n.body, n.created_at from enquiry_notes n left join users u on u.id = n.author_id
          where n.enquiry_id = $1 order by n.created_at desc`,
        [req.params.id],
      );
      res.json({ ...enquiry, notes });
    }),
  );

  router.post(
    '/',
    route(async (req, res) => {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error);
      const actor = currentUser(res);
      const now = ctx.now();
      const newId = await ctx.db.transaction(async (tx) => {
        await assertRefs(tx, parsed.data);
        const created = await insertRow(tx, 'enquiries', { ...parsed.data, created_at: now, updated_at: now });
        await recordActivity(tx, { actorId: actor.id, entity: 'enquiries', entityId: created, action: 'create', changes: { full_name: parsed.data.full_name, source: parsed.data.source }, at: now });
        return created;
      });
      res.status(201).json(await getEnquiry(ctx.db, newId));
    }),
  );

  router.patch(
    '/:id',
    route(async (req, res) => {
      const parsed = patchBody.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error);
      const before = await getEnquiry(ctx.db, req.params.id);
      const actor = currentUser(res);
      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        await assertRefs(tx, parsed.data);
        const changes = diff(before, parsed.data);
        if (!Object.keys(changes).length) return;
        await updateRow(tx, 'enquiries', req.params.id, { ...parsed.data, updated_at: now });
        await recordActivity(tx, { actorId: actor.id, entity: 'enquiries', entityId: req.params.id, action: 'update', changes, at: now });
      });
      res.json(await getEnquiry(ctx.db, req.params.id));
    }),
  );

  router.post(
    '/:id/notes',
    route(async (req, res) => {
      const parsed = noteBody.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error);
      await getEnquiry(ctx.db, req.params.id);
      const actor = currentUser(res);
      const now = ctx.now();
      const note = await ctx.db.transaction(async (tx) => {
        const [row] = await tx.query<{ id: string }>(
          'insert into enquiry_notes (enquiry_id, author_id, body, created_at) values ($1, $2, $3, $4) returning id, body, created_at',
          [req.params.id, actor.id, parsed.data.body, now],
        );
        await recordActivity(tx, { actorId: actor.id, entity: 'enquiries', entityId: req.params.id, action: 'update', changes: { note: 'added' }, at: now });
        return row;
      });
      res.status(201).json({ ...note, author_name: actor.full_name });
    }),
  );

  return router;
}
