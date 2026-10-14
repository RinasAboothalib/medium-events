import { Router } from 'express';
import type { AppContext } from '../app.js';
import { currentUser } from '../auth/middleware.js';
import { route } from '../http.js';
import { can } from '../permissions.js';
import { maldivesTime } from '../reports/pdf.js';
import { formatMoney } from '../sales/money.js';

type Card = { id: string; label: string; value: string };
const DAY = 24 * 60 * 60 * 1000;

// Start of the current calendar month in the Maldives (UTC+5, no daylight saving)
function maldivesMonthStart(now: Date): string {
  return `${new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 7)}-01T00:00:00+05:00`;
}

// GET /api/dashboard: headline figures for the signed-in person's role. Money only for roles that may see it.
export function dashboardRoutes(ctx: AppContext) {
  const router = Router();

  router.get(
    '/',
    route(async (_req, res) => {
      const role = currentUser(res).role;
      const now = ctx.now();
      const month = maldivesMonthStart(now);
      const cards: Card[] = [];
      const count = async (sql: string, params: unknown[] = []) => String((await ctx.db.query<{ n: number }>(sql, params))[0].n);

      if (can(role, 'enquiries.access')) {
        cards.push({ id: 'new_enquiries', label: 'New enquiries (last 7 days)', value: await count('select count(*)::int as n from enquiries where created_at >= $1', [new Date(now.getTime() - 7 * DAY)]) });
        cards.push({ id: 'open_enquiries', label: 'Open enquiries', value: await count("select count(*)::int as n from enquiries where status in ('new', 'contacted', 'proposal_sent')") });
        cards.push({ id: 'confirmed_deals_month', label: 'Deals confirmed this month', value: await count("select count(*)::int as n from deals where status = 'confirmed' and created_at >= $1::timestamptz", [month]) });
      }

      if (can(role, 'payments.write')) {
        const outstanding = await ctx.db.query<{ currency: string; amount: number }>(
          `select d.currency, sum(d.amount - coalesce(p.paid, 0))::float8 as amount
             from deals d left join (select deal_id, sum(amount) as paid from payments group by deal_id) p on p.deal_id = d.id
            where d.status <> 'cancelled' group by d.currency order by d.currency`,
        );
        if (outstanding.length) {
          for (const o of outstanding) cards.push({ id: `outstanding_${o.currency}`, label: `Outstanding (${o.currency})`, value: formatMoney(o.amount, o.currency) });
        } else {
          cards.push({ id: 'outstanding', label: 'Outstanding', value: 'Nothing outstanding' });
        }
        const received = await ctx.db.query<{ currency: string; amount: number }>(
          `select d.currency, sum(p.amount)::float8 as amount from payments p join deals d on d.id = p.deal_id
            where p.paid_on >= ($1::timestamptz at time zone 'UTC' + interval '5 hours')::date group by d.currency order by d.currency`,
          [month],
        );
        cards.push({ id: 'payments_month', label: 'Received this month', value: received.length ? received.map((r) => formatMoney(r.amount, r.currency)).join(' · ') : 'None yet' });
      }

      if (can(role, 'events.publish')) {
        cards.push({ id: 'upcoming_editions', label: 'Upcoming events', value: await count("select count(*)::int as n from editions where status = 'upcoming'") });
        // Overdue is judged against today's date in the Maldives
        const [tasks] = await ctx.db.query<{ open: number; overdue: number }>(
          "select count(*)::int as open, count(*) filter (where due_date < $1::date)::int as overdue from tasks where status <> 'done'",
          [new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)],
        );
        cards.push({ id: 'open_tasks', label: 'Open tasks', value: tasks.overdue ? `${tasks.open} (${tasks.overdue} overdue)` : String(tasks.open) });
        const [last] = await ctx.db.query<{ published_at: Date }>('select published_at from published_snapshots order by id desc limit 1');
        cards.push({ id: 'last_publish', label: 'Website last updated', value: last ? maldivesTime(new Date(last.published_at)) : 'Never' });
      }

      res.json({ cards });
    }),
  );

  return router;
}
