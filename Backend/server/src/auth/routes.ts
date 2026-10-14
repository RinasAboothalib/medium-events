import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import { recordActivity } from '../activity.js';
import { Lockout } from './lockout.js';
import { currentUser } from './middleware.js';
import { MIN_PASSWORD_LENGTH, hashPassword, verifyAgainstDummy, verifyPassword } from './passwords.js';
import { COOKIE_NAME, MAX_MS, createSession, deleteSession, deleteUserSessions } from './sessions.js';

const INCORRECT = 'Email or password is incorrect.';

const loginBody = z.object({ email: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });
const changeBody = z.object({ current_password: z.string(), new_password: z.string() });

// /api/auth/login is public; the rest of this router runs behind requireAuth (see app.ts)
export function publicAuthRoutes(ctx: AppContext) {
  const router = Router();
  const lockout = new Lockout();

  router.post('/login', async (req, res, next) => {
    try {
      const parsed = loginBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Enter your email and password.' });
      const { email, password } = parsed.data;
      const now = ctx.now();
      if (lockout.isLocked(email, now)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });

      const [user] = await ctx.db.query<{ id: string; password_hash: string; active: boolean }>(
        'select id, password_hash, active from users where email = $1',
        [email],
      );
      const ok = user ? (await verifyPassword(password, user.password_hash)) && user.active : await verifyAgainstDummy(password);
      if (!ok) {
        lockout.recordFailure(email, now);
        return res.status(401).json({ error: INCORRECT });
      }

      lockout.reset(email);
      const token = await ctx.db.transaction(async (tx) => {
        await tx.query('update users set last_login_at = $2 where id = $1', [user!.id, now]);
        await recordActivity(tx, { actorId: user!.id, entity: 'session', entityId: user!.id, action: 'login', at: now });
        return createSession(tx, user!.id, now);
      });
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        // The server ends sessions after 8 idle hours; the cookie itself lasts the 30-day maximum
        maxAge: MAX_MS,
      });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

export function authRoutes(ctx: AppContext) {
  const router = Router();

  router.get('/me', (_req, res) => {
    res.json(currentUser(res));
  });

  router.post('/logout', async (_req, res, next) => {
    try {
      await deleteSession(ctx.db, res.locals.token);
      res.clearCookie(COOKIE_NAME, { path: '/' });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  router.post('/change-password', async (req, res, next) => {
    try {
      const parsed = changeBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Enter your current and new password.' });
      const { current_password, new_password } = parsed.data;
      const user = currentUser(res);
      const [row] = await ctx.db.query<{ password_hash: string }>('select password_hash from users where id = $1', [user.id]);

      if (!(await verifyPassword(current_password, row.password_hash))) return res.status(400).json({ error: 'Your current password is incorrect.' });
      if (new_password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
      if (new_password === current_password) return res.status(400).json({ error: 'Choose a password different from your current one.' });

      const now = ctx.now();
      await ctx.db.transaction(async (tx) => {
        await tx.query('update users set password_hash = $2, must_change_password = false, updated_at = $3 where id = $1', [
          user.id,
          await hashPassword(new_password),
          now,
        ]);
        await deleteUserSessions(tx, user.id, res.locals.token);
        await recordActivity(tx, { actorId: user.id, entity: 'users', entityId: user.id, action: 'update', changes: { password: 'changed' }, at: now });
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  return router;
}
