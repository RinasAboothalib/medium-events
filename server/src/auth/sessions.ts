import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/index.js';
import type { Role } from '../permissions.js';

export const COOKIE_NAME = 'medium_session';
export const IDLE_MS = 8 * 60 * 60 * 1000;
export const MAX_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_MS = 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  must_change_password: boolean;
}

// Only the hash is stored, so a copy of the database can't be used to sign in
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string, now: Date): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    'insert into sessions (token_hash, user_id, created_at, last_seen_at, expires_at) values ($1, $2, $3, $3, $4)',
    [hashToken(token), userId, now, new Date(now.getTime() + MAX_MS)],
  );
  return token;
}

// Returns the signed-in, active user for a token, or null if the session is missing, idle, expired or the user is deactivated
export async function findSessionUser(db: Db, token: string, now: Date): Promise<SessionUser | null> {
  const [row] = await db.query<SessionUser & { token_hash: string; last_seen_at: Date; expires_at: Date; active: boolean }>(
    `select s.token_hash, s.last_seen_at, s.expires_at, u.id, u.email, u.full_name, u.role, u.must_change_password, u.active
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1`,
    [hashToken(token)],
  );
  if (!row) return null;
  const idle = now.getTime() - new Date(row.last_seen_at).getTime() >= IDLE_MS;
  const expired = now.getTime() >= new Date(row.expires_at).getTime();
  if (idle || expired || !row.active) {
    await db.query('delete from sessions where token_hash = $1', [row.token_hash]);
    return null;
  }
  if (now.getTime() - new Date(row.last_seen_at).getTime() >= TOUCH_MS) {
    await db.query('update sessions set last_seen_at = $2 where token_hash = $1', [row.token_hash, now]);
  }
  return { id: row.id, email: row.email, full_name: row.full_name, role: row.role, must_change_password: row.must_change_password };
}

export const deleteSession = (db: Db, token: string) => db.query('delete from sessions where token_hash = $1', [hashToken(token)]);

export const deleteUserSessions = (db: Db, userId: string, exceptToken?: string) =>
  exceptToken
    ? db.query('delete from sessions where user_id = $1 and token_hash <> $2', [userId, hashToken(exceptToken)])
    : db.query('delete from sessions where user_id = $1', [userId]);
