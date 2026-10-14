import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { insertRow, updateRow } from '../crud.js';
import { isUuid } from '../files/routes.js';
import { HttpError, route, validationError } from '../http.js';

const text = (message: string) => z.string().trim().min(1, message);
const optionalText = z.string().trim().nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31.');
const count = z.number().int().min(0, 'Use 0 or more.').nullable();
const uuid = (message: string) => z.string().regex(/^[0-9a-f-]{36}$/i, message);

const seriesFields = {
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Use lower-case letters, numbers and dashes only.'),
  name: text('Enter the series name.'),
  label: text('Enter the short label shown on event cards.'),
  short_name: text('Enter a short name, e.g. CIF.'),
  tagline: z.string().trim(),
  description: z.array(z.string().trim().min(1)).max(10),
  website: optionalText,
  endorsement: optionalText,
  audience: z.string().trim(),
  usual_venue: z.string().trim(),
  usual_month: z.string().trim(),
  cta_secondary: optionalText,
  sort_order: z.number().int(),
  active: z.boolean(),
};
const seriesCreate = z.object({
  ...seriesFields,
  tagline: seriesFields.tagline.default(''),
  description: seriesFields.description.default([]),
  audience: seriesFields.audience.default(''),
  usual_venue: seriesFields.usual_venue.default(''),
  usual_month: seriesFields.usual_month.default(''),
  sort_order: seriesFields.sort_order.default(0),
  active: seriesFields.active.default(true),
});
const seriesPatch = z.object(seriesFields).partial();

const editionFields = {
  series_id: uuid('Choose a series.'),
  name: text('Enter the edition name.'),
  start_date: date,
  end_date: date.nullable(),
  venue: z.string().trim(),
  description: z.string().trim(),
  rsvp_count: count,
  attendance: count,
  facebook_url: optionalText,
  banner_file_id: uuid('Upload the banner again.').nullable(),
  status: z.enum(['upcoming', 'past', 'cancelled'], { message: 'Choose a status.' }),
  outcome_notes: z.string().trim(),
};
const editionPatch = z.object(editionFields).partial();
const editionCreate = editionPatch.extend({ series_id: editionFields.series_id, name: editionFields.name, start_date: editionFields.start_date });

const partnerFields = {
  name: text("Enter the partner's name."),
  role: z.string().trim(),
  series_id: uuid('Choose a series.').nullable(),
  edition_id: uuid('Choose an edition.').nullable(),
  sort_order: z.number().int(),
};
const partnerPatch = z.object(partnerFields).partial();
const partnerCreate = partnerPatch
  .extend({ name: partnerFields.name })
  .refine((p) => p.series_id || p.edition_id, { message: 'Choose a series or an edition.', path: ['series_id'] });

const SERIES_SQL = `select s.id, s.slug, s.name, s.label, s.short_name, s.tagline, s.description, s.website, s.endorsement, s.audience,
  s.usual_venue, s.usual_month, s.cta_secondary, s.sort_order, s.active,
  (select count(*)::int from editions e where e.series_id = s.id) as edition_count
  from event_series s`;
const EDITION_SQL = `select e.id, e.series_id, s.name as series_name, e.name, e.start_date::text as start_date, e.end_date::text as end_date,
  e.venue, e.description, e.rsvp_count, e.attendance, e.facebook_url, e.banner_file_id, e.status, e.outcome_notes
  from editions e join event_series s on s.id = e.series_id`;
const PARTNER_SQL = 'select p.id, p.name, p.role, p.series_id, p.edition_id, p.sort_order from partners p';
const SERIES = { sql: SERIES_SQL, alias: 's' };
const EDITION = { sql: EDITION_SQL, alias: 'e' };
const PARTNER = { sql: PARTNER_SQL, alias: 'p' };

type Row = Record<string, unknown>;

async function one(db: Db, base: { sql: string; alias: string }, id: string, missing: string): Promise<Row> {
  const [row] = isUuid(id) ? await db.query<Row>(`${base.sql} where ${base.alias}.id = $1`, [id]) : [];
  if (!row) throw new HttpError(404, missing);
  return row;
}

async function assertSlugFree(tx: Db, slug: string, exceptId: string | null) {
  const taken = await tx.query('select 1 from event_series where slug = $1 and id is distinct from $2', [slug, exceptId]);
  if (taken.length) throw new HttpError(409, 'That web address is already used by another series.');
}

async function assertEditionRefs(tx: Db, e: { series_id?: string; banner_file_id?: string | null; start_date?: string; end_date?: string | null }) {
  if (e.series_id && !(await tx.query('select 1 from event_series where id = $1', [e.series_id])).length) {
    throw new HttpError(400, 'Check the highlighted fields.', { series_id: 'Choose a series.' });
  }
  if (e.banner_file_id && !(await tx.query('select 1 from files where id = $1', [e.banner_file_id])).length) {
    throw new HttpError(400, 'Check the highlighted fields.', { banner_file_id: 'Upload the banner again.' });
  }
  if (e.start_date && e.end_date && e.end_date < e.start_date) {
    throw new HttpError(400, 'Check the highlighted fields.', { end_date: 'The end date must be on or after the start date.' });
  }
}

async function assertPartnerRefs(tx: Db, p: { series_id?: string | null; edition_id?: string | null }) {
  if (p.series_id && !(await tx.query('select 1 from event_series where id = $1', [p.series_id])).length) {
    throw new HttpError(400, 'Check the highlighted fields.', { series_id: 'Choose a series.' });
  }
  if (p.edition_id && !(await tx.query('select 1 from editions where id = $1', [p.edition_id])).length) {
    throw new HttpError(400, 'Check the highlighted fields.', { edition_id: 'Choose an edition.' });
  }
}

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

// Event series, their editions and partners. Everyone can read; admin and events staff can change them.
export function eventRoutes(ctx: AppContext) {
  const series = Router();
  const editions = Router();
  const partners = Router();
  const write = requirePermission('events.write');
  const read = requirePermission('events.read');

  // A write: runs in a transaction, logs the change, and returns the fresh row
  const change = async (
    res: Parameters<typeof currentUser>[0],
    entity: string,
    fn: (tx: Db) => Promise<{ id: string; action: 'create' | 'update' | 'delete'; changes?: Record<string, unknown> }>,
  ) => {
    const actor = currentUser(res);
    const now = ctx.now();
    return ctx.db.transaction(async (tx) => {
      const result = await fn(tx);
      if (result.action !== 'update' || Object.keys(result.changes ?? {}).length) {
        await recordActivity(tx, { actorId: actor.id, entity, entityId: result.id, action: result.action, changes: result.changes, at: now });
      }
      return result.id;
    });
  };

  // ---- series ----
  series.get('/', read, route(async (_req, res) => res.json(await ctx.db.query(`${SERIES_SQL} order by s.sort_order, s.name`))));
  series.get('/:id', read, route(async (req, res) => res.json(await one(ctx.db, SERIES, req.params.id, 'That series was not found.'))));

  series.post(
    '/',
    write,
    route(async (req, res) => {
      const body = parse(seriesCreate, req.body);
      const id = await change(res, 'event_series', async (tx) => {
        await assertSlugFree(tx, body.slug, null);
        const newId = await insertRow(tx, 'event_series', body);
        return { id: newId, action: 'create', changes: { slug: body.slug, name: body.name } };
      });
      res.status(201).json(await one(ctx.db, SERIES, id, ''));
    }),
  );

  series.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const patch = parse(seriesPatch, req.body);
      const before = await one(ctx.db, SERIES, req.params.id, 'That series was not found.');
      await change(res, 'event_series', async (tx) => {
        if (patch.slug) await assertSlugFree(tx, patch.slug, req.params.id);
        const changes = diff(before, patch);
        if (Object.keys(changes).length) await updateRow(tx, 'event_series', req.params.id, { ...patch, updated_at: ctx.now() });
        return { id: req.params.id, action: 'update', changes };
      });
      res.json(await one(ctx.db, SERIES, req.params.id, ''));
    }),
  );

  series.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, SERIES, req.params.id, 'That series was not found.');
      await change(res, 'event_series', async (tx) => {
        if ((await tx.query('select 1 from editions where series_id = $1', [req.params.id])).length) {
          throw new HttpError(409, "Remove this series' editions first.");
        }
        await tx.query('delete from event_series where id = $1', [req.params.id]);
        return { id: req.params.id, action: 'delete', changes: { slug: before.slug, name: before.name } };
      });
      res.status(204).end();
    }),
  );

  // ---- editions ----
  editions.get(
    '/',
    read,
    route(async (req, res) => {
      const seriesId = typeof req.query.series_id === 'string' && isUuid(req.query.series_id) ? req.query.series_id : null;
      const rows = await ctx.db.query(`${EDITION_SQL} ${seriesId ? 'where e.series_id = $1' : ''} order by e.start_date desc, e.name`, seriesId ? [seriesId] : []);
      res.json(rows);
    }),
  );
  editions.get('/:id', read, route(async (req, res) => res.json(await one(ctx.db, EDITION, req.params.id, 'That edition was not found.'))));

  editions.post(
    '/',
    write,
    route(async (req, res) => {
      const body = parse(editionCreate, req.body);
      const id = await change(res, 'editions', async (tx) => {
        await assertEditionRefs(tx, body);
        const newId = await insertRow(tx, 'editions', body);
        return { id: newId, action: 'create', changes: { name: body.name, start_date: body.start_date } };
      });
      res.status(201).json(await one(ctx.db, EDITION, id, ''));
    }),
  );

  editions.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const patch = parse(editionPatch, req.body);
      const before = await one(ctx.db, EDITION, req.params.id, 'That edition was not found.');
      await change(res, 'editions', async (tx) => {
        await assertEditionRefs(tx, {
          ...patch,
          start_date: patch.start_date ?? (before.start_date as string),
          end_date: patch.end_date === undefined ? (before.end_date as string | null) : patch.end_date,
        });
        const changes = diff(before, patch);
        if (Object.keys(changes).length) await updateRow(tx, 'editions', req.params.id, { ...patch, updated_at: ctx.now() });
        return { id: req.params.id, action: 'update', changes };
      });
      res.json(await one(ctx.db, EDITION, req.params.id, ''));
    }),
  );

  editions.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, EDITION, req.params.id, 'That edition was not found.');
      await change(res, 'editions', async (tx) => {
        if ((await tx.query('select 1 from deals where edition_id = $1', [req.params.id])).length) {
          throw new HttpError(409, 'This edition has sponsorship deals. Cancel it instead, or move its deals first.');
        }
        // Delegates and expenses are records worth keeping; the checklist and programme go with the edition
        if ((await tx.query('select 1 from delegates where edition_id = $1 limit 1', [req.params.id])).length) {
          throw new HttpError(409, 'This edition has delegates on its register. Cancel it instead, or remove them first.');
        }
        if ((await tx.query('select 1 from expenses where edition_id = $1 limit 1', [req.params.id])).length) {
          throw new HttpError(409, 'This edition has expenses recorded. Cancel it instead, or remove them first.');
        }
        await tx.query('delete from editions where id = $1', [req.params.id]);
        return { id: req.params.id, action: 'delete', changes: { name: before.name } };
      });
      res.status(204).end();
    }),
  );

  // ---- partners ----
  partners.get(
    '/',
    read,
    route(async (req, res) => {
      const where: string[] = [];
      const params: string[] = [];
      for (const key of ['series_id', 'edition_id'] as const) {
        const value = req.query[key];
        if (typeof value === 'string' && isUuid(value)) {
          params.push(value);
          where.push(`p.${key} = $${params.length}`);
        }
      }
      res.json(await ctx.db.query(`${PARTNER_SQL} ${where.length ? `where ${where.join(' and ')}` : ''} order by p.sort_order, p.name`, params));
    }),
  );

  partners.post(
    '/',
    write,
    route(async (req, res) => {
      const body = parse(partnerCreate, req.body);
      const id = await change(res, 'partners', async (tx) => {
        await assertPartnerRefs(tx, body);
        const newId = await insertRow(tx, 'partners', body);
        return { id: newId, action: 'create', changes: { name: body.name, role: body.role ?? '' } };
      });
      res.status(201).json(await one(ctx.db, PARTNER, id, ''));
    }),
  );

  partners.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const patch = parse(partnerPatch, req.body);
      const before = await one(ctx.db, PARTNER, req.params.id, 'That partner was not found.');
      await change(res, 'partners', async (tx) => {
        await assertPartnerRefs(tx, patch);
        const merged = { ...before, ...patch };
        if (!merged.series_id && !merged.edition_id) {
          throw new HttpError(400, 'Check the highlighted fields.', { series_id: 'Choose a series or an edition.' });
        }
        const changes = diff(before, patch);
        await updateRow(tx, 'partners', req.params.id, patch);
        return { id: req.params.id, action: 'update', changes };
      });
      res.json(await one(ctx.db, PARTNER, req.params.id, ''));
    }),
  );

  partners.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, PARTNER, req.params.id, 'That partner was not found.');
      await change(res, 'partners', async (tx) => {
        await tx.query('delete from partners where id = $1', [req.params.id]);
        return { id: req.params.id, action: 'delete', changes: { name: before.name } };
      });
      res.status(204).end();
    }),
  );

  return { series, editions, partners };
}
