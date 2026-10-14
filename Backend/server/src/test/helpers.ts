// Test helpers: a fresh in-memory database per call, an adjustable clock, and quick ways to create users.
import { join } from 'node:path';
import request from 'supertest';
import { openDb, type Db } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import { createApp } from '../app.js';
import { hashPassword, setPasswordCost } from '../auth/passwords.js';
import type { Role } from '../permissions.js';

setPasswordCost(4); // fast hashing in tests only

export const PASSWORD = 'Correct-Horse-1';

export async function setup(opts: Omit<Parameters<typeof createApp>[0], 'db' | 'now'> = {}) {
  const db = await openDb({ dataDir: 'memory' });
  await migrate(db, join(import.meta.dirname, '..', '..', 'migrations'));
  const clock = { now: new Date('2026-10-13T04:00:00Z') };
  const app = createApp({ db, now: () => clock.now, ...opts });
  return {
    db,
    app,
    clock,
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
    agent: () => request.agent(app),
  };
}

export async function createUser(
  db: Db,
  opts: { email?: string; role?: Role; full_name?: string; password?: string; active?: boolean; must_change_password?: boolean } = {},
) {
  const role = opts.role ?? 'admin';
  const [user] = await db.query<{ id: string; email: string }>(
    `insert into users (email, full_name, role, active, password_hash, must_change_password)
     values ($1, $2, $3, $4, $5, $6) returning id, email`,
    [
      opts.email ?? `${role}@medium.test`,
      opts.full_name ?? `Test ${role}`,
      role,
      opts.active ?? true,
      await hashPassword(opts.password ?? PASSWORD),
      opts.must_change_password ?? false,
    ],
  );
  return user;
}

// Signs in through the real login route and returns an agent carrying the session cookie
export async function signedIn(app: Parameters<typeof request.agent>[0], email: string, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const ROLE_LIST: Role[] = ['admin', 'sales', 'events', 'finance'];

// One signed-in agent per role (admin@medium.mv, sales@medium.mv, …) plus their user ids
export async function signedInAsEveryRole(t: Awaited<ReturnType<typeof setup>>) {
  const ids = {} as Record<Role, string>;
  const as = {} as Record<Role, Awaited<ReturnType<typeof signedIn>>>;
  for (const role of ROLE_LIST) {
    ids[role] = (await createUser(t.db, { role, email: `${role}@medium.mv`, full_name: `Test ${role}` })).id;
    as[role] = await signedIn(t.app, `${role}@medium.mv`);
  }
  return { ids, as };
}

// Smallest valid JPEG-typed body for upload tests (content is not decoded by the server)
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
