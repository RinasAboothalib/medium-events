import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { route, validationError } from '../http.js';
import { can } from '../permissions.js';

export const PAGE_SIZE = 50;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31.');

const query = z.object({
  actor: z.string().uuid().optional(),
  entity: z.string().max(50).optional(),
  action: z.enum(['create', 'update', 'delete', 'login', 'publish', 'export']).optional(),
  from: date.optional(),
  to: date.optional(),
  page: z.coerce.number().int().min(0).default(0),
});

export function activityRoutes(ctx: AppContext) {
  const router = Router();

  router.get(
    '/',
    requirePermission('activity.readOwn'),
    route(async (req, res) => {
      const parsed = query.safeParse(req.query);
      if (!parsed.success) throw validationError(parsed.error);
      const f = parsed.data;
      const user = currentUser(res);
      // Non-admins only ever see their own entries
      const actor = can(user.role, 'activity.readAll') ? f.actor : user.id;

      const where: string[] = [];
      const params: unknown[] = [];
      const add = (sql: string, value: unknown) => {
        params.push(value);
        where.push(sql.replace('?', `$${params.length}`));
      };
      if (actor) add('a.actor_id = ?', actor);
      if (f.entity) add('a.entity = ?', f.entity);
      if (f.action) add('a.action = ?', f.action);
      // Filter dates are Maldives calendar days (UTC+5)
      if (f.from) add('a.at >= ?::timestamptz', `${f.from}T00:00:00+05:00`);
      if (f.to) add("a.at < (?::timestamptz + interval '1 day')", `${f.to}T00:00:00+05:00`);
      const whereSql = where.length ? `where ${where.join(' and ')}` : '';

      const [{ total }] = await ctx.db.query<{ total: number }>(`select count(*)::int as total from activity_log a ${whereSql}`, params);
      const rows = await ctx.db.query(
        `select a.id::int as id, a.at, a.actor_id, u.full_name as actor_name, a.entity, a.entity_id, a.action, a.changes
           from activity_log a left join users u on u.id = a.actor_id
           ${whereSql}
          order by a.at desc, a.id desc
          limit ${PAGE_SIZE} offset ${f.page * PAGE_SIZE}`,
        params,
      );
      res.json({ rows, total });
    }),
  );

  return router;
}
