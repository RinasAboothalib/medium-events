import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { insertRow, pageOf, updateRow } from '../crud.js';
import { HttpError, route } from '../http.js';
import { editionFilter, email, one, parse, requireEdition, text, uuid, whereBuilder } from '../validate.js';

export const DELEGATE_CATEGORIES = ['delegate', 'speaker', 'sponsor', 'exhibitor', 'vip', 'media', 'staff'] as const;
export const DELEGATE_STATUSES = ['invited', 'registered', 'confirmed', 'attended', 'cancelled', 'no_show'] as const;
export const PAGE_SIZE = 50;

const fields = {
  edition_id: uuid('Choose an edition.'),
  full_name: z.string().trim().min(1, "Enter the person's name.").max(200),
  company: text,
  job_title: text,
  email,
  phone: text,
  category: z.enum(DELEGATE_CATEGORIES, { message: 'Choose a category.' }),
  status: z.enum(DELEGATE_STATUSES, { message: 'Choose a status.' }),
  notes: text,
};
// A delegate stays with their edition
const delegatePatch = z.object(fields).omit({ edition_id: true }).partial();
const delegateCreate = z.object(fields).partial().extend({ edition_id: fields.edition_id, full_name: fields.full_name });

export const DELEGATE_SQL = `select g.id, g.edition_id, e.name as edition_name, g.full_name, g.company, g.job_title, g.email, g.phone,
  g.category, g.status, g.checked_in_at, g.notes, g.created_at
  from delegates g join editions e on e.id = g.edition_id`;
const MISSING = 'That delegate was not found.';

// Filters shared by the list and the delegate report
export function delegateFilters(query: Record<string, unknown>) {
  const w = whereBuilder();
  const editionId = editionFilter(query);
  if (editionId) w.add('g.edition_id = ?', editionId);
  if (typeof query.status === 'string' && (DELEGATE_STATUSES as readonly string[]).includes(query.status)) w.add('g.status = ?', query.status);
  if (typeof query.category === 'string' && (DELEGATE_CATEGORIES as readonly string[]).includes(query.category)) w.add('g.category = ?', query.category);
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 200) : '';
  if (q) w.add('(g.full_name ilike ? or g.company ilike ? or g.email ilike ? or g.phone ilike ?)', `%${q.replace(/[%_\\]/g, '\\$&')}%`);
  return w;
}

// Head-counts for one edition (or all of them): everyone on the register, by status, and how many are checked in
export async function delegateSummary(db: Db, editionId: string | null) {
  const rows = await db.query<{ status: string; n: number; checked_in: number }>(
    `select status, count(*)::int as n, count(checked_in_at)::int as checked_in from delegates ${editionId ? 'where edition_id = $1' : ''} group by status`,
    editionId ? [editionId] : [],
  );
  const by_status = Object.fromEntries(DELEGATE_STATUSES.map((s) => [s, rows.find((r) => r.status === s)?.n ?? 0]));
  return { total: rows.reduce((sum, r) => sum + r.n, 0), checked_in: rows.reduce((sum, r) => sum + r.checked_in, 0), by_status };
}

async function assertEmailFree(tx: Db, editionId: string, address: string | undefined, exceptId: string | null) {
  if (!address) return;
  const taken = await tx.query('select 1 from delegates where edition_id = $1 and lower(email) = lower($2) and id is distinct from $3', [editionId, address, exceptId]);
  if (taken.length) throw new HttpError(409, 'Someone with that email is already registered for this event.', { email: 'Already registered for this event.' });
}

// The register of people attending an edition, entered by staff, with check-in at the door.
export function delegateRoutes(ctx: AppContext) {
  const router = Router();
  const read = requirePermission('delegates.read');
  const write = requirePermission('delegates.write');

  const log = (tx: Db, res: Response, entityId: string, action: 'create' | 'update' | 'delete', changes?: Record<string, unknown>) =>
    recordActivity(tx, { actorId: currentUser(res).id, entity: 'delegates', entityId, action, changes, at: ctx.now() });

  // ?edition_id= ?status= ?category= ?q= ?page=. The summary covers the whole edition, whatever the other filters.
  router.get(
    '/',
    read,
    route(async (req, res) => {
      const w = delegateFilters(req.query);
      const page = pageOf(req.query.page);
      const [{ total }] = await ctx.db.query<{ total: number }>(`select count(*)::int as total from delegates g ${w.sql}`, w.params);
      const rows = await ctx.db.query(`${DELEGATE_SQL} ${w.sql} order by lower(g.full_name), g.id limit ${PAGE_SIZE} offset ${page * PAGE_SIZE}`, w.params);
      res.json({ rows, total, summary: await delegateSummary(ctx.db, editionFilter(req.query)) });
    }),
  );

  router.get('/:id', read, route(async (req, res) => res.json(await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING))));

  router.post(
    '/',
    write,
    route(async (req, res) => {
      const body = parse(delegateCreate, req.body);
      const now = ctx.now();
      const id = await ctx.db.transaction(async (tx) => {
        await requireEdition(tx, body.edition_id);
        await assertEmailFree(tx, body.edition_id, body.email, null);
        const newId = await insertRow(tx, 'delegates', {
          ...body,
          // Added as already attended (e.g. a walk-in at the door) counts as checked in
          checked_in_at: body.status === 'attended' ? now : undefined,
          created_by: currentUser(res).id,
          created_at: now,
          updated_at: now,
        });
        await log(tx, res, newId, 'create', { full_name: body.full_name, edition_id: body.edition_id });
        return newId;
      });
      res.status(201).json(await one(ctx.db, DELEGATE_SQL, 'g', id, MISSING));
    }),
  );

  router.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const patch = parse(delegatePatch, req.body);
      const before = await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING);
      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        await assertEmailFree(tx, before.edition_id as string, patch.email, req.params.id);
        const changes = diff(before, patch);
        if (!Object.keys(changes).length) return;
        // The check-in time follows the status: set on "attended", cleared when moved to anything else
        const statusChanged = patch.status !== undefined && patch.status !== before.status;
        const checked_in_at = !statusChanged ? undefined : patch.status === 'attended' ? ((before.checked_in_at as Date | null) ?? now) : null;
        await updateRow(tx, 'delegates', req.params.id, { ...patch, checked_in_at, updated_at: now });
        await log(tx, res, req.params.id, 'update', changes);
      });
      res.json(await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING));
    }),
  );

  // Check-in at the door: marks the person as attended, once
  router.post(
    '/:id/check-in',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING);
      if (before.status === 'cancelled') throw new HttpError(409, 'This registration is cancelled. Change its status first.');
      if (before.checked_in_at) throw new HttpError(409, `${before.full_name} is already checked in.`);
      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        await updateRow(tx, 'delegates', req.params.id, { status: 'attended', checked_in_at: now, updated_at: now });
        await log(tx, res, req.params.id, 'update', { checked_in: true, status: { old: before.status, new: 'attended' } });
      });
      res.json(await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING));
    }),
  );

  // Undo a check-in made by mistake
  router.delete(
    '/:id/check-in',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING);
      if (!before.checked_in_at) throw new HttpError(409, `${before.full_name} is not checked in.`);
      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        await updateRow(tx, 'delegates', req.params.id, { status: 'confirmed', checked_in_at: null, updated_at: now });
        await log(tx, res, req.params.id, 'update', { checked_in: false, status: { old: before.status, new: 'confirmed' } });
      });
      res.json(await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING));
    }),
  );

  router.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, DELEGATE_SQL, 'g', req.params.id, MISSING);
      await ctx.db.transaction(async (tx) => {
        await tx.query('delete from delegates where id = $1', [req.params.id]);
        await log(tx, res, req.params.id, 'delete', { full_name: before.full_name, edition_id: before.edition_id });
      });
      res.status(204).end();
    }),
  );

  return router;
}
