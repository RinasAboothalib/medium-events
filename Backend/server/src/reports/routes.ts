import { Router, type Response } from 'express';
import type { AppContext } from '../app.js';
import { recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { route } from '../http.js';
import { budgetXlsx } from './budget.js';
import { delegatesXlsx } from './delegates.js';
import { enquiriesXlsx } from './enquiries.js';
import { postEventPdf } from './postEvent.js';
import { parseSponsorshipFilters, sponsorshipPdf, sponsorshipXlsx } from './sponsorship.js';

const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// "CIF 2026" → "CIF-2026"
const fileSafe = (name: string) => name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';

// Downloads; each one is logged as an export with the filters used
export function reportRoutes(ctx: AppContext) {
  const router = Router();

  const send = async (res: Response, report: string, filters: Record<string, unknown>, file: { name: string; type: string; body: Buffer }) => {
    await ctx.db.transaction((tx) =>
      recordActivity(tx, { actorId: currentUser(res).id, entity: 'reports', entityId: report, action: 'export', changes: { report, filters }, at: ctx.now() }),
    );
    res.set('Content-Type', file.type).set('Content-Disposition', `attachment; filename="${file.name}"`).set('Cache-Control', 'no-store').send(file.body);
  };

  router.get(
    '/post-event/:editionId.pdf',
    requirePermission('reports.postEvent'),
    route(async (req, res) => {
      const { name, pdf } = await postEventPdf(ctx.db, req.params.editionId, ctx.now());
      await send(res, 'post-event', { edition_id: req.params.editionId }, { name: `${fileSafe(name)}-post-event-report.pdf`, type: PDF, body: pdf });
    }),
  );

  router.get(
    '/sponsorship.xlsx',
    requirePermission('reports.sponsorship'),
    route(async (req, res) => {
      const filters = parseSponsorshipFilters(req.query);
      await send(res, 'sponsorship', filters, { name: 'sponsorship-report.xlsx', type: XLSX, body: await sponsorshipXlsx(ctx.db, filters) });
    }),
  );

  router.get(
    '/sponsorship.pdf',
    requirePermission('reports.sponsorship'),
    route(async (req, res) => {
      const filters = parseSponsorshipFilters(req.query);
      await send(res, 'sponsorship', filters, { name: 'sponsorship-report.pdf', type: PDF, body: await sponsorshipPdf(ctx.db, filters, ctx.now()) });
    }),
  );

  router.get(
    '/enquiries.xlsx',
    requirePermission('reports.enquiries'),
    route(async (req, res) => {
      const filters = Object.fromEntries(Object.entries(req.query).filter(([k, v]) => ['status', 'source', 'from', 'to'].includes(k) && v));
      await send(res, 'enquiries', filters, { name: 'enquiries-report.xlsx', type: XLSX, body: await enquiriesXlsx(ctx.db, filters) });
    }),
  );

  router.get(
    '/delegates.xlsx',
    requirePermission('reports.delegates'),
    route(async (req, res) => {
      const filters = Object.fromEntries(Object.entries(req.query).filter(([k, v]) => ['edition_id', 'status', 'category'].includes(k) && v));
      await send(res, 'delegates', filters, { name: 'delegates-report.xlsx', type: XLSX, body: await delegatesXlsx(ctx.db, filters) });
    }),
  );

  router.get(
    '/budget.xlsx',
    requirePermission('reports.budget'),
    route(async (req, res) => {
      const filters = Object.fromEntries(Object.entries(req.query).filter(([k, v]) => k === 'edition_id' && v));
      await send(res, 'budget', filters, { name: 'budget-report.xlsx', type: XLSX, body: await budgetXlsx(ctx.db, filters) });
    }),
  );

  return router;
}
