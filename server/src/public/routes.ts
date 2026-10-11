import { Router } from 'express';
import type { AppContext } from '../app.js';
import { sendFile } from '../files/routes.js';
import { HttpError, route } from '../http.js';
import { publicCors } from './cors.js';
import { publicEnquiryRoutes } from './enquiries.js';

// No sign-in: what the public website needs to build its event pages
export function publicRoutes(ctx: AppContext) {
  const router = Router();
  router.use(publicCors(ctx.config.publicSiteOrigin));
  router.use('/enquiries', publicEnquiryRoutes(ctx));

  const latest = async () => {
    const [row] = await ctx.db.query<{ data: Record<string, unknown> }>('select data from published_snapshots order by id desc limit 1');
    return row?.data ?? null;
  };

  router.get(
    '/site-data',
    route(async (_req, res) => {
      const data = await latest();
      if (!data) throw new HttpError(404, 'Nothing published yet.');
      res.set('Cache-Control', 'no-cache').json(data);
    }),
  );

  // Only images the published site uses, so unpublished uploads stay private
  router.get(
    '/files/:id',
    route(async (req, res) => {
      const data = await latest();
      const path = `/api/public/files/${req.params.id}`;
      if (!data || !JSON.stringify(data).includes(`"${path}"`)) throw new HttpError(404, 'That image was not found.');
      await sendFile(ctx.db, req.params.id, res, 'public, max-age=86400');
    }),
  );

  return router;
}
