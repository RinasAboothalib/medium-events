import { Router } from 'express';
import type { AppContext } from '../app.js';
import { recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { route } from '../http.js';
import { buildSnapshot } from './snapshot.js';

// "Publish to website": saves what the public site is built from and, if configured, asks the host to rebuild it
export function publishRoutes(ctx: AppContext) {
  const router = Router();

  router.post(
    '/',
    requirePermission('events.publish'),
    route(async (_req, res) => {
      const actor = currentUser(res);
      const now = ctx.now();
      const snapshot = await buildSnapshot(ctx.db, now);
      const counts = { series: snapshot.series.length, events: snapshot.events.length };
      await ctx.db.transaction(async (tx) => {
        const [row] = await tx.query<{ id: number }>(
          'insert into published_snapshots (published_at, published_by, data) values ($1, $2, $3) returning id::int',
          [now, actor.id, JSON.stringify(snapshot)],
        );
        await recordActivity(tx, { actorId: actor.id, entity: 'publish', entityId: String(row.id), action: 'publish', changes: counts, at: now });
      });

      let deployHook: 'sent' | 'failed' | 'not_configured' = 'not_configured';
      if (ctx.config.deployHookUrl) {
        try {
          const hook = await ctx.fetch(ctx.config.deployHookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
          deployHook = hook.ok ? 'sent' : 'failed';
        } catch {
          deployHook = 'failed';
        }
      }
      res.json({ published_at: snapshot.published_at, ...counts, deploy_hook: deployHook });
    }),
  );

  router.get(
    '/latest',
    requirePermission('events.read'),
    route(async (_req, res) => {
      const [row] = await ctx.db.query<{ published_at: Date; published_by_name: string | null; series: number; events: number }>(
        `select p.published_at, u.full_name as published_by_name,
                jsonb_array_length(p.data->'series')::int as series, jsonb_array_length(p.data->'events')::int as events
           from published_snapshots p left join users u on u.id = p.published_by
          order by p.id desc limit 1`,
      );
      res.json(row ? { ...row, published_at: new Date(row.published_at).toISOString() } : null);
    }),
  );

  return router;
}
