import express, { type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import type { Db } from './db/index.js';
import { requireAuth } from './auth/middleware.js';
import { authRoutes, publicAuthRoutes } from './auth/routes.js';
import { staffRoutes } from './staff/routes.js';
import { activityRoutes } from './activity/routes.js';
import { fileRoutes } from './files/routes.js';
import { eventRoutes } from './events/routes.js';
import { publishRoutes } from './publish/routes.js';
import { publicRoutes } from './public/routes.js';
import { enquiryRoutes } from './enquiries/routes.js';
import { salesRoutes } from './sales/routes.js';
import { reportRoutes } from './reports/routes.js';
import { dashboardRoutes } from './dashboard/routes.js';
import { taskRoutes } from './tasks/routes.js';
import { programmeRoutes } from './programme/routes.js';
import { delegateRoutes } from './delegates/routes.js';
import { expenseRoutes } from './expenses/routes.js';
import { HttpError } from './http.js';

export interface AppContext {
  db: Db;
  // Injectable clock so tests can move time (session expiry, lockout)
  now: () => Date;
  // Injectable for tests (deploy hook)
  fetch: typeof fetch;
  config: AppConfig;
}

export interface AppConfig {
  // Public website address allowed to call /api/public from the browser
  publicSiteOrigin?: string;
  // Called (POST) after publishing so the host rebuilds the website
  deployHookUrl?: string;
}

// adminDist: folder of the built admin app (Frontend/admin/dist) to serve in production, from the same origin as /api
export function createApp(opts: { db: Db; now?: () => Date; fetch?: typeof fetch; config?: AppConfig; adminDist?: string }) {
  const ctx: AppContext = { db: opts.db, now: opts.now ?? (() => new Date()), fetch: opts.fetch ?? fetch, config: opts.config ?? {} };
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Public routes (no sign-in)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', publicAuthRoutes(ctx));
  app.use('/api/public', publicRoutes(ctx));

  // Everything else under /api needs a signed-in, active user
  app.use('/api', requireAuth(ctx));
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/staff', staffRoutes(ctx));
  app.use('/api/activity', activityRoutes(ctx));
  app.use('/api/files', fileRoutes(ctx));
  const events = eventRoutes(ctx);
  app.use('/api/series', events.series);
  app.use('/api/editions', events.editions);
  app.use('/api/partners', events.partners);
  app.use('/api/publish', publishRoutes(ctx));
  app.use('/api/enquiries', enquiryRoutes(ctx));
  const sales = salesRoutes(ctx);
  app.use('/api/sponsors', sales.sponsors);
  app.use('/api/deals', sales.deals);
  app.use('/api/payments', sales.payments);
  app.use('/api/tasks', taskRoutes(ctx));
  const programme = programmeRoutes(ctx);
  app.use('/api/speakers', programme.speakers);
  app.use('/api/sessions', programme.sessions);
  app.use('/api/delegates', delegateRoutes(ctx));
  app.use('/api/expenses', expenseRoutes(ctx));
  app.use('/api/reports', reportRoutes(ctx));
  app.use('/api/dashboard', dashboardRoutes(ctx));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  if (opts.adminDist) {
    const dist = opts.adminDist;
    // Hashed asset files never change; index.html is always re-checked so new releases load
    app.use('/assets', express.static(join(dist, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false }));
    app.use(express.static(dist, { index: false, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache').sendFile(join(dist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json(err.fields ? { error: err.message, fields: err.fields } : { error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  });

  return app;
}
