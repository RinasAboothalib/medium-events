import type { NextFunction, Request, Response } from 'express';
import { can, type Permission } from '../permissions.js';
import type { AppContext } from '../app.js';
import { COOKIE_NAME, findSessionUser, type SessionUser } from './sessions.js';

export function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export const currentUser = (res: Response) => res.locals.user as SessionUser;

// Routes a user still on a temporary password may use
const ALLOWED_BEFORE_PASSWORD_CHANGE = new Set(['GET /api/auth/me', 'POST /api/auth/logout', 'POST /api/auth/change-password']);

// Every /api route requires a signed-in, active user unless it is listed as public
export function requireAuth(ctx: AppContext) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = readSessionToken(req);
      const user = token ? await findSessionUser(ctx.db, token, ctx.now()) : null;
      if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
      res.locals.user = user;
      res.locals.token = token;
      const route = `${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, '');
      if (user.must_change_password && !ALLOWED_BEFORE_PASSWORD_CHANGE.has(route)) {
        return res.status(403).json({ error: 'password_change_required' });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function requirePermission(permission: Permission) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!can(currentUser(res).role, permission)) return res.status(403).json({ error: "You don't have access to this." });
    next();
  };
}
