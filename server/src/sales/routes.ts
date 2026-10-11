import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { insertRow, updateRow } from '../crud.js';
import { isUuid } from '../files/routes.js';
import { HttpError, route, validationError } from '../http.js';
import { can } from '../permissions.js';
import { currency, money } from './money.js';

const uuid = (message: string) => z.string().regex(/^[0-9a-f-]{36}$/i, message);
const text = z.string().trim().max(5000);

const sponsorFields = {
  company: z.string().trim().min(1, 'Enter the company name.').max(200),
  contact_name: text,
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address.')]),
  phone: text,
  notes: text,
};
const sponsorPatch = z.object(sponsorFields).partial();
const sponsorCreate = sponsorPatch.extend({ company: sponsorFields.company });

const dealFields = {
  sponsor_id: uuid('Choose a sponsor.'),
  edition_id: uuid('Choose an edition.'),
  package: z.string().trim().min(1, 'Enter the package, e.g. Gold sponsor.').max(200),
  amount: money,
  currency,
  status: z.enum(['proposed', 'confirmed', 'cancelled'], { message: 'Choose a status.' }),
  enquiry_id: uuid('Choose an enquiry.').nullable(),
  notes: text,
};
const dealPatch = z.object(dealFields).partial();
const dealCreate = dealPatch.extend({ sponsor_id: dealFields.sponsor_id, edition_id: dealFields.edition_id, package: dealFields.package, amount: dealFields.amount, currency: dealFields.currency });

const paymentCreate = z.object({
  amount: money,
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31.'),
  method: z.enum(['bank_transfer', 'cash', 'cheque', 'card', 'other'], { message: 'Choose how it was paid.' }),
  invoice_no: text.optional(),
  notes: text.optional(),
});

const PAID = '(select deal_id, sum(amount) as paid from payments group by deal_id)';
export const DEAL_SQL = `select d.id, d.sponsor_id, sp.company as sponsor_company, d.edition_id, e.name as edition_name, d.package, d.status,
  d.enquiry_id, d.notes, d.created_at, d.amount::float8 as amount, d.currency,
  coalesce(p.paid, 0)::float8 as paid, (d.amount - coalesce(p.paid, 0))::float8 as outstanding
  from deals d join sponsors sp on sp.id = d.sponsor_id join editions e on e.id = d.edition_id left join ${PAID} p on p.deal_id = d.id`;
const SPONSOR_SQL = `select s.id, s.company, s.contact_name, s.email, s.phone, s.notes, s.created_at,
  (select count(*)::int from deals d where d.sponsor_id = s.id) as deal_count from sponsors s`;
const PAYMENT_SQL = `select p.id, p.deal_id, p.amount::float8 as amount, p.paid_on::text as paid_on, p.method, p.invoice_no, p.notes,
  u.full_name as recorded_by_name, p.created_at from payments p left join users u on u.id = p.recorded_by`;

type Row = Record<string, unknown>;
const MONEY_KEYS = ['amount', 'currency', 'paid', 'outstanding', 'notes'];

// Events staff see sponsors, packages and statuses, never money (or deal notes, which often mention it)
export function stripMoney(res: Response, deal: Row): Row {
  if (can(currentUser(res).role, 'deals.readAmounts')) return deal;
  return Object.fromEntries(Object.entries(deal).filter(([k]) => !MONEY_KEYS.includes(k)));
}

// Builds the where clause shared by the deals list and the sponsorship report
export function dealFilters(query: Record<string, unknown>) {
  const where: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of [['edition_id', 'd.edition_id'], ['sponsor_id', 'd.sponsor_id']] as const) {
    const value = query[key];
    if (typeof value === 'string' && isUuid(value)) {
      params.push(value);
      where.push(`${column} = $${params.length}`);
    }
  }
  if (typeof query.status === 'string' && ['proposed', 'confirmed', 'cancelled'].includes(query.status)) {
    params.push(query.status);
    where.push(`d.status = $${params.length}`);
  }
  return { where, params };
}

// Per-currency totals of proposed and confirmed deals (cancelled ones never count)
export async function dealTotals(db: Db, where: string[], params: unknown[]) {
  const all = [...where, "d.status <> 'cancelled'"];
  return db.query<{ currency: string; amount: number; paid: number; outstanding: number }>(
    `select d.currency, sum(d.amount)::float8 as amount, sum(coalesce(p.paid, 0))::float8 as paid,
            sum(d.amount - coalesce(p.paid, 0))::float8 as outstanding
       from deals d left join ${PAID} p on p.deal_id = d.id
      where ${all.join(' and ')} group by d.currency order by d.currency`,
    params,
  );
}

async function one(db: Db, sql: string, alias: string, id: string, missing: string): Promise<Row> {
  const [row] = isUuid(id) ? await db.query<Row>(`${sql} where ${alias}.id = $1`, [id]) : [];
  if (!row) throw new HttpError(404, missing);
  return row;
}

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

async function assertCompanyFree(tx: Db, company: string, exceptId: string | null) {
  const taken = await tx.query('select 1 from sponsors where lower(company) = lower($1) and id is distinct from $2', [company, exceptId]);
  if (taken.length) throw new HttpError(409, 'That sponsor already exists.');
}

async function assertDealRefs(tx: Db, d: { sponsor_id?: string; edition_id?: string; enquiry_id?: string | null }) {
  const checks: [string | null | undefined, string, string, string][] = [
    [d.sponsor_id, 'sponsors', 'sponsor_id', 'Choose a sponsor.'],
    [d.edition_id, 'editions', 'edition_id', 'Choose an edition.'],
    [d.enquiry_id, 'enquiries', 'enquiry_id', 'Choose an enquiry.'],
  ];
  for (const [value, table, field, message] of checks) {
    if (value && !(await tx.query(`select 1 from ${table} where id = $1`, [value])).length) {
      throw new HttpError(400, 'Check the highlighted fields.', { [field]: message });
    }
  }
}

// Sponsors, their deals (per edition) and payments against each deal
export function salesRoutes(ctx: AppContext) {
  const sponsors = Router();
  const deals = Router();
  const payments = Router();

  const log = (tx: Db, res: Response, entity: string, entityId: string, action: 'create' | 'update' | 'delete', changes?: Record<string, unknown>) =>
    recordActivity(tx, { actorId: currentUser(res).id, entity, entityId, action, changes, at: ctx.now() });

  // ---- sponsors ----
  sponsors.get('/', requirePermission('sponsors.read'), route(async (_req, res) => res.json(await ctx.db.query(`${SPONSOR_SQL} order by lower(s.company)`))));

  sponsors.get(
    '/:id',
    requirePermission('sponsors.read'),
    route(async (req, res) => {
      const sponsor = await one(ctx.db, SPONSOR_SQL, 's', req.params.id, 'That sponsor was not found.');
      const rows = await ctx.db.query<Row>(`${DEAL_SQL} where d.sponsor_id = $1 order by d.created_at desc`, [req.params.id]);
      res.json({ ...sponsor, deals: rows.map((d) => stripMoney(res, d)) });
    }),
  );

  sponsors.post(
    '/',
    requirePermission('sponsors.write'),
    route(async (req, res) => {
      const body = parse(sponsorCreate, req.body);
      const id = await ctx.db.transaction(async (tx) => {
        await assertCompanyFree(tx, body.company, null);
        const newId = await insertRow(tx, 'sponsors', { ...body, created_at: ctx.now(), updated_at: ctx.now() });
        await log(tx, res, 'sponsors', newId, 'create', { company: body.company });
        return newId;
      });
      res.status(201).json(await one(ctx.db, SPONSOR_SQL, 's', id, ''));
    }),
  );

  sponsors.patch(
    '/:id',
    requirePermission('sponsors.write'),
    route(async (req, res) => {
      const patch = parse(sponsorPatch, req.body);
      const before = await one(ctx.db, SPONSOR_SQL, 's', req.params.id, 'That sponsor was not found.');
      await ctx.db.transaction(async (tx) => {
        if (patch.company) await assertCompanyFree(tx, patch.company, req.params.id);
        const changes = diff(before, patch);
        if (!Object.keys(changes).length) return;
        await updateRow(tx, 'sponsors', req.params.id, { ...patch, updated_at: ctx.now() });
        await log(tx, res, 'sponsors', req.params.id, 'update', changes);
      });
      res.json(await one(ctx.db, SPONSOR_SQL, 's', req.params.id, ''));
    }),
  );

  // ---- deals ----
  deals.get(
    '/',
    requirePermission('deals.read'),
    route(async (req, res) => {
      const { where, params } = dealFilters(req.query);
      const rows = await ctx.db.query<Row>(`${DEAL_SQL} ${where.length ? `where ${where.join(' and ')}` : ''} order by e.start_date desc, lower(sp.company)`, params);
      const showMoney = can(currentUser(res).role, 'deals.readAmounts');
      res.json({ rows: rows.map((d) => stripMoney(res, d)), ...(showMoney ? { totals: await dealTotals(ctx.db, where, params) } : {}) });
    }),
  );

  deals.get('/:id', requirePermission('deals.read'), route(async (req, res) => res.json(stripMoney(res, await one(ctx.db, DEAL_SQL, 'd', req.params.id, 'That deal was not found.')))));

  deals.post(
    '/',
    requirePermission('deals.write'),
    route(async (req, res) => {
      const body = parse(dealCreate, req.body);
      const id = await ctx.db.transaction(async (tx) => {
        await assertDealRefs(tx, body);
        const newId = await insertRow(tx, 'deals', { ...body, created_by: currentUser(res).id, created_at: ctx.now(), updated_at: ctx.now() });
        await log(tx, res, 'deals', newId, 'create', { package: body.package, amount: body.amount, currency: body.currency, status: body.status ?? 'proposed' });
        return newId;
      });
      res.status(201).json(await one(ctx.db, DEAL_SQL, 'd', id, ''));
    }),
  );

  deals.patch(
    '/:id',
    requirePermission('deals.write'),
    route(async (req, res) => {
      const patch = parse(dealPatch, req.body);
      const before = await one(ctx.db, DEAL_SQL, 'd', req.params.id, 'That deal was not found.');
      await ctx.db.transaction(async (tx) => {
        await assertDealRefs(tx, patch);
        const changes = diff(before, patch);
        if (!Object.keys(changes).length) return;
        await updateRow(tx, 'deals', req.params.id, { ...patch, updated_at: ctx.now() });
        await log(tx, res, 'deals', req.params.id, 'update', changes);
      });
      res.json(await one(ctx.db, DEAL_SQL, 'd', req.params.id, ''));
    }),
  );

  // ---- payments ----
  deals.get(
    '/:id/payments',
    requirePermission('payments.read'),
    route(async (req, res) => {
      await one(ctx.db, DEAL_SQL, 'd', req.params.id, 'That deal was not found.');
      res.json(await ctx.db.query(`${PAYMENT_SQL} where p.deal_id = $1 order by p.paid_on desc, p.created_at desc`, [req.params.id]));
    }),
  );

  deals.post(
    '/:id/payments',
    requirePermission('payments.write'),
    route(async (req, res) => {
      const body = parse(paymentCreate, req.body);
      const dealRow = await one(ctx.db, DEAL_SQL, 'd', req.params.id, 'That deal was not found.');
      if (dealRow.status === 'cancelled') throw new HttpError(409, 'This deal is cancelled.');
      const id = await ctx.db.transaction(async (tx) => {
        const newId = await insertRow(tx, 'payments', { ...body, deal_id: req.params.id, recorded_by: currentUser(res).id, created_at: ctx.now() });
        await log(tx, res, 'payments', newId, 'create', { deal_id: req.params.id, amount: body.amount, currency: dealRow.currency, paid_on: body.paid_on });
        return newId;
      });
      res.status(201).json(await one(ctx.db, PAYMENT_SQL, 'p', id, ''));
    }),
  );

  payments.delete(
    '/:id',
    requirePermission('payments.delete'),
    route(async (req, res) => {
      const before = await one(ctx.db, PAYMENT_SQL, 'p', req.params.id, 'That payment was not found.');
      await ctx.db.transaction(async (tx) => {
        await tx.query('delete from payments where id = $1', [req.params.id]);
        await log(tx, res, 'payments', req.params.id, 'delete', { deal_id: before.deal_id, amount: before.amount, paid_on: before.paid_on });
      });
      res.status(204).end();
    }),
  );

  return { sponsors, deals, payments };
}
