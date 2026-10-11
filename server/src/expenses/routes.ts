import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { insertRow, updateRow } from '../crud.js';
import { route } from '../http.js';
import { currency, money } from '../sales/money.js';
import { date, editionFilter, fieldError, one, parse, requireEdition, text, uuid, whereBuilder } from '../validate.js';

export const EXPENSE_CATEGORIES = ['venue', 'catering', 'av_production', 'marketing', 'printing', 'travel', 'accommodation', 'staffing', 'speakers', 'decor', 'other'] as const;
export const EXPENSE_STATUSES = ['planned', 'committed', 'paid'] as const;

const fields = {
  edition_id: uuid('Choose an edition.'),
  category: z.enum(EXPENSE_CATEGORIES, { message: 'Choose a category.' }),
  description: z.string().trim().min(1, 'Enter what the money is for.').max(300),
  vendor: text,
  amount: money,
  currency,
  status: z.enum(EXPENSE_STATUSES, { message: 'Choose a status.' }),
  paid_on: date.nullable(),
  invoice_no: text,
  notes: text,
};
// An expense stays with its edition
const expensePatch = z.object(fields).omit({ edition_id: true }).partial();
const expenseCreate = z
  .object(fields)
  .partial()
  .extend({ edition_id: fields.edition_id, category: fields.category, description: fields.description, amount: fields.amount, currency: fields.currency });

export const EXPENSE_SQL = `select x.id, x.edition_id, e.name as edition_name, x.category, x.description, x.vendor, x.amount::float8 as amount,
  x.currency, x.status, x.paid_on::text as paid_on, x.invoice_no, x.notes, u.full_name as created_by_name, x.created_at
  from expenses x join editions e on e.id = x.edition_id left join users u on u.id = x.created_by`;
const MISSING = 'That expense was not found.';

export interface BudgetLine {
  currency: string;
  // Sponsorship: confirmed deals, and what has been received against deals that are not cancelled
  income_confirmed: number;
  income_received: number;
  // Expenses by how far along they are; expenses_total is all three
  expenses_planned: number;
  expenses_committed: number;
  expenses_paid: number;
  expenses_total: number;
  // What the edition should make once everything is settled, and the cash position today
  projected_result: number;
  cash_result: number;
}

// Income against expenses for one edition (or every edition), one line per currency
export async function budgetSummary(db: Db, editionId: string | null): Promise<BudgetLine[]> {
  const params = editionId ? [editionId] : [];
  const scope = (alias: string) => (editionId ? `and ${alias}.edition_id = $1` : '');
  const rows = await db.query<Omit<BudgetLine, 'expenses_total' | 'projected_result' | 'cash_result'>>(
    `with income as (
       select d.currency, sum(d.amount) filter (where d.status = 'confirmed') as confirmed,
              sum((select coalesce(sum(p.amount), 0) from payments p where p.deal_id = d.id)) as received
         from deals d where d.status <> 'cancelled' ${scope('d')} group by d.currency),
     costs as (
       select x.currency, sum(x.amount) filter (where x.status = 'planned') as planned,
              sum(x.amount) filter (where x.status = 'committed') as committed,
              sum(x.amount) filter (where x.status = 'paid') as paid
         from expenses x where true ${scope('x')} group by x.currency)
     select coalesce(i.currency, c.currency) as currency,
            coalesce(i.confirmed, 0)::float8 as income_confirmed, coalesce(i.received, 0)::float8 as income_received,
            coalesce(c.planned, 0)::float8 as expenses_planned, coalesce(c.committed, 0)::float8 as expenses_committed,
            coalesce(c.paid, 0)::float8 as expenses_paid
       from income i full join costs c on c.currency = i.currency order by 1`,
    params,
  );
  // Rounded to cents so float sums never show as 0.30000000000000004
  const round = (n: number) => Math.round(n * 100) / 100;
  return rows.map((r) => {
    const expenses_total = round(r.expenses_planned + r.expenses_committed + r.expenses_paid);
    return { ...r, expenses_total, projected_result: round(r.income_confirmed - expenses_total), cash_result: round(r.income_received - r.expenses_paid) };
  });
}

// Filters shared by the list and the budget report
export function expenseFilters(query: Record<string, unknown>) {
  const w = whereBuilder();
  const editionId = editionFilter(query);
  if (editionId) w.add('x.edition_id = ?', editionId);
  if (typeof query.status === 'string' && (EXPENSE_STATUSES as readonly string[]).includes(query.status)) w.add('x.status = ?', query.status);
  if (typeof query.category === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(query.category)) w.add('x.category = ?', query.category);
  return w;
}

// A paid expense needs the date it was paid
function assertPaid(e: { status?: unknown; paid_on?: unknown }) {
  if (e.status === 'paid' && !e.paid_on) throw fieldError('paid_on', 'Enter the date it was paid.');
}

// What an edition costs, and how that compares with its sponsorship income. Admin and finance only.
export function expenseRoutes(ctx: AppContext) {
  const router = Router();
  const read = requirePermission('expenses.read');
  const write = requirePermission('expenses.write');

  const log = (tx: Db, res: Response, entityId: string, action: 'create' | 'update' | 'delete', changes?: Record<string, unknown>) =>
    recordActivity(tx, { actorId: currentUser(res).id, entity: 'expenses', entityId, action, changes, at: ctx.now() });

  // ?edition_id= ?status= ?category=, newest first
  router.get(
    '/',
    read,
    route(async (req, res) => {
      const w = expenseFilters(req.query);
      res.json(await ctx.db.query(`${EXPENSE_SQL} ${w.sql} order by x.created_at desc, x.id`, w.params));
    }),
  );

  // Income against expenses per currency: ?edition_id= for one edition, otherwise every edition
  router.get('/summary', read, route(async (req, res) => res.json(await budgetSummary(ctx.db, editionFilter(req.query)))));

  router.get('/:id', read, route(async (req, res) => res.json(await one(ctx.db, EXPENSE_SQL, 'x', req.params.id, MISSING))));

  router.post(
    '/',
    write,
    route(async (req, res) => {
      const body = parse(expenseCreate, req.body);
      assertPaid(body);
      const now = ctx.now();
      const id = await ctx.db.transaction(async (tx) => {
        await requireEdition(tx, body.edition_id);
        const newId = await insertRow(tx, 'expenses', { ...body, created_by: currentUser(res).id, created_at: now, updated_at: now });
        await log(tx, res, newId, 'create', { description: body.description, amount: body.amount, currency: body.currency, status: body.status ?? 'planned' });
        return newId;
      });
      res.status(201).json(await one(ctx.db, EXPENSE_SQL, 'x', id, MISSING));
    }),
  );

  router.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const patch = parse(expensePatch, req.body);
      const before = await one(ctx.db, EXPENSE_SQL, 'x', req.params.id, MISSING);
      assertPaid({ ...before, ...patch });
      await ctx.db.transaction(async (tx) => {
        const changes = diff(before, patch);
        if (!Object.keys(changes).length) return;
        await updateRow(tx, 'expenses', req.params.id, { ...patch, updated_at: ctx.now() });
        await log(tx, res, req.params.id, 'update', changes);
      });
      res.json(await one(ctx.db, EXPENSE_SQL, 'x', req.params.id, MISSING));
    }),
  );

  router.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, EXPENSE_SQL, 'x', req.params.id, MISSING);
      await ctx.db.transaction(async (tx) => {
        await tx.query('delete from expenses where id = $1', [req.params.id]);
        await log(tx, res, req.params.id, 'delete', { description: before.description, amount: before.amount, currency: before.currency });
      });
      res.status(204).end();
    }),
  );

  return router;
}
