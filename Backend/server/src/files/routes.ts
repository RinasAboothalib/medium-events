import express, { Router, type NextFunction, type Request, type Response } from 'express';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { HttpError, route } from '../http.js';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

// Reads the raw image body; the size limit error becomes a plain message
const rawImage = [
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  (err: { type?: string }, _req: Request, _res: Response, next: NextFunction) =>
    next(err.type === 'entity.too.large' ? new HttpError(413, 'Images must be 5 MB or smaller.') : err),
];

export async function sendFile(db: Db, id: string, res: Response, cacheControl: string) {
  const [file] = isUuid(id) ? await db.query<{ content_type: string; data: Uint8Array }>('select content_type, data from files where id = $1', [id]) : [];
  if (!file) throw new HttpError(404, 'That image was not found.');
  res.set('Content-Type', file.content_type).set('Cache-Control', cacheControl).send(Buffer.from(file.data));
}

// Images (event banners) live in Postgres, so they persist in Supabase without its Storage service.
// Upload: POST /api/files?filename=<name> with the image as the request body and its Content-Type.
export function fileRoutes(ctx: AppContext) {
  const router = Router();

  router.post(
    '/',
    requirePermission('events.write'),
    ...rawImage,
    route(async (req, res) => {
      const type = String(req.headers['content-type'] ?? '').split(';')[0].trim();
      const data = req.body as Buffer;
      if (!IMAGE_TYPES.includes(type) || !Buffer.isBuffer(data)) throw new HttpError(400, 'Upload a JPG, PNG or WebP image.');
      if (data.length === 0) throw new HttpError(400, 'The image is empty.');
      const filename = String(req.query.filename ?? 'image').slice(0, 200) || 'image';
      const actor = currentUser(res);
      const now = ctx.now();
      const file = await ctx.db.transaction(async (tx) => {
        const [row] = await tx.query<{ id: string }>(
          'insert into files (filename, content_type, size, data, created_by, created_at) values ($1, $2, $3, $4, $5, $6) returning id, filename, content_type, size',
          [filename, type, data.length, data, actor.id, now],
        );
        await recordActivity(tx, { actorId: actor.id, entity: 'files', entityId: row.id, action: 'create', changes: { filename, size: data.length }, at: now });
        return row;
      });
      res.status(201).json(file);
    }),
  );

  router.get(
    '/:id',
    requirePermission('events.read'),
    route((req, res) => sendFile(ctx.db, req.params.id, res, 'private, max-age=3600')),
  );

  router.delete(
    '/:id',
    requirePermission('events.write'),
    route(async (req, res) => {
      const id = req.params.id;
      if (!isUuid(id)) throw new HttpError(404, 'That image was not found.');
      const actor = currentUser(res);
      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        const used = await tx.query('select 1 from editions where banner_file_id = $1', [id]);
        if (used.length) throw new HttpError(409, 'This image is used as an event banner.');
        const rows = await tx.query('delete from files where id = $1 returning id', [id]);
        if (!rows.length) throw new HttpError(404, 'That image was not found.');
        await recordActivity(tx, { actorId: actor.id, entity: 'files', entityId: id, action: 'delete', at: now });
      });
      res.status(204).end();
    }),
  );

  return router;
}
