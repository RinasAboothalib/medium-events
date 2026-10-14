import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import { recordActivity } from '../activity.js';
import { insertRow } from '../crud.js';
import { HttpError, route, validationError } from '../http.js';
import { RateLimiter } from './rateLimit.js';

// Same fields as the website's enquiry form (src/components/EnquiryForm.tsx)
const text = z.string().trim().max(5000).optional().default('');
const body = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.').max(200),
    company: text,
    email: z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address.')]).optional().default(''),
    phone: text,
    service: text,
    event: text,
    timeline: text,
    budget: text,
    message: text,
  })
  .refine((b) => b.email || b.phone, { message: 'Enter an email address or phone number.', path: ['email'] });

// POST /api/public/enquiries: the website form records each enquiry here (no sign-in)
export function publicEnquiryRoutes(ctx: AppContext) {
  const router = Router();
  const limiter = new RateLimiter(10, 60 * 60 * 1000);

  router.post(
    '/',
    route(async (req, res) => {
      // Bots fill the hidden honeypot: answer normally, store nothing
      const honeypot = req.body?.botcheck;
      if (honeypot !== undefined && honeypot !== '' && honeypot !== false) return res.status(200).json({ ok: true });
      if (!limiter.allow(req.ip ?? 'unknown', ctx.now())) throw new HttpError(429, 'Too many enquiries from this connection. Try again later.');

      const parsed = body.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error);
      const { name, ...rest } = parsed.data;
      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        const id = await insertRow(tx, 'enquiries', { full_name: name, ...rest, source: 'website', created_at: now, updated_at: now });
        await recordActivity(tx, { actorId: null, entity: 'enquiries', entityId: id, action: 'create', changes: { full_name: name, source: 'website' }, at: now });
      });
      res.status(201).json({ ok: true });
    }),
  );

  return router;
}
