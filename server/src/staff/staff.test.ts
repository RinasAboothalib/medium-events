import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PASSWORD, createUser, setup, signedIn } from '../test/helpers.js';
import type { Role } from '../permissions.js';
import { assertAdminRemains } from './routes.js';

let t: Awaited<ReturnType<typeof setup>>;
let ids: Record<Role, string>;
let as: Record<Role, Awaited<ReturnType<typeof signedIn>>>;

beforeEach(async () => {
  t = await setup();
  ids = {} as typeof ids;
  as = {} as typeof as;
  for (const role of ['admin', 'sales', 'events', 'finance'] as Role[]) {
    ids[role] = (await createUser(t.db, { role, email: `${role}@medium.mv`, full_name: `Test ${role}` })).id;
    as[role] = await signedIn(t.app, `${role}@medium.mv`);
  }
});

const newStaff = { email: 'New@Medium.mv', full_name: 'New Person', role: 'events', temp_password: 'Temporary-123' };

describe('listing staff', () => {
  it('gives admins full details', async () => {
    const res = await as.admin.get('/api/staff');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ email: expect.any(String), active: true, must_change_password: false, last_login_at: expect.any(String) }),
    );
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|\$2[aby]\$/);
  });

  it('gives everyone else names and roles only', async () => {
    const res = await as.finance.get('/api/staff');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body[0]).sort()).toEqual(['active', 'full_name', 'id', 'role']);
  });
});

describe('staff changes are admin-only', () => {
  it.each(['sales', 'events', 'finance'] as Role[])('%s cannot create, edit or reset', async (role) => {
    expect((await as[role].post('/api/staff').send(newStaff)).status).toBe(403);
    expect((await as[role].patch(`/api/staff/${ids.sales}`).send({ role: 'admin' })).status).toBe(403);
    expect((await as[role].post(`/api/staff/${ids.sales}/reset-password`).send({ temp_password: 'Temporary-123' })).status).toBe(403);
  });
});

describe('creating staff', () => {
  it('creates an account that must change its temporary password', async () => {
    const res = await as.admin.post('/api/staff').send(newStaff);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'new@medium.mv', role: 'events', must_change_password: true });
    const login = await request(t.app).post('/api/auth/login').send({ email: 'new@medium.mv', password: 'Temporary-123' });
    expect(login.status).toBe(200);
    const [log] = await t.db.query<{ actor_id: string; action: string; changes: Record<string, unknown> }>(
      "select actor_id, action, changes from activity_log where entity = 'users' and action = 'create'",
    );
    expect(log).toMatchObject({ actor_id: ids.admin, changes: { email: 'new@medium.mv', role: 'events' } });
    expect(JSON.stringify(log.changes)).not.toMatch(/Temporary-123/);
  });

  it('refuses an email that already exists, in any case', async () => {
    const res = await as.admin.post('/api/staff').send({ ...newStaff, email: ' SALES@medium.mv ' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('That email already has an account.');
  });

  it('validates every field', async () => {
    const res = await as.admin.post('/api/staff').send({ email: 'bad', full_name: ' ', role: 'owner', temp_password: 'short' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['email', 'full_name', 'role', 'temp_password']);
  });
});

describe('editing staff', () => {
  it('changes role and name, logging only what changed', async () => {
    const res = await as.admin.patch(`/api/staff/${ids.sales}`).send({ role: 'finance', full_name: 'Test sales' });
    expect(res.status).toBe(200);
    const [log] = await t.db.query<{ changes: Record<string, unknown> }>(
      "select changes from activity_log where entity = 'users' and action = 'update' and entity_id = $1",
      [ids.sales],
    );
    expect(log.changes).toEqual({ role: { old: 'sales', new: 'finance' } });
  });

  it("doesn't let anyone change their own role or active status", async () => {
    expect((await as.admin.patch(`/api/staff/${ids.admin}`).send({ role: 'sales' })).status).toBe(400);
    expect((await as.admin.patch(`/api/staff/${ids.admin}`).send({ active: false })).status).toBe(400);
    expect((await as.admin.patch(`/api/staff/${ids.admin}`).send({ full_name: 'Renamed Admin' })).status).toBe(200);
  });

  it('never leaves zero active admins, even when two admins demote each other at once', async () => {
    const second = (await createUser(t.db, { email: 'second@medium.mv', role: 'admin' })).id;
    const secondAgent = await signedIn(t.app, 'second@medium.mv');
    const results = await Promise.all([
      as.admin.patch(`/api/staff/${second}`).send({ role: 'sales' }),
      secondAgent.patch(`/api/staff/${ids.admin}`).send({ role: 'sales' }),
    ]);
    const count = await t.db.query<{ n: number }>("select count(*)::int as n from users where role = 'admin' and active");
    expect(count[0].n).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.status === 409 || r.status === 403)).toBe(true);
  });

  it('explains the last-admin rule when a change would remove the only active admin', async () => {
    await t.db.query("delete from users where role = 'admin' and email <> 'admin@medium.mv'");
    await expect(t.db.transaction((tx) => assertAdminRemains(tx, ids.admin))).rejects.toThrow('There must always be at least one active admin.');
    const second = (await createUser(t.db, { email: 'second@medium.mv', role: 'admin' })).id;
    await expect(t.db.transaction((tx) => assertAdminRemains(tx, second))).resolves.toBeUndefined();
  });

  it('ends all sessions of someone who is deactivated', async () => {
    expect((await as.sales.get('/api/auth/me')).status).toBe(200);
    await as.admin.patch(`/api/staff/${ids.sales}`).send({ active: false });
    expect((await as.sales.get('/api/auth/me')).status).toBe(401);
  });
});

describe('resetting passwords', () => {
  it('sets a temporary password, forces a change and ends their sessions', async () => {
    const res = await as.admin.post(`/api/staff/${ids.events}/reset-password`).send({ temp_password: 'Temporary-456' });
    expect(res.status).toBe(204);
    expect((await as.events.get('/api/auth/me')).status).toBe(401);
    expect((await request(t.app).post('/api/auth/login').send({ email: 'events@medium.mv', password: PASSWORD })).status).toBe(401);
    const fresh = await signedIn(t.app, 'events@medium.mv', 'Temporary-456');
    expect((await fresh.get('/api/auth/me')).body.must_change_password).toBe(true);
  });

  it("won't reset your own password here", async () => {
    expect((await as.admin.post(`/api/staff/${ids.admin}/reset-password`).send({ temp_password: 'Temporary-456' })).status).toBe(400);
  });

  it('needs 10 characters and an existing person', async () => {
    expect((await as.admin.post(`/api/staff/${ids.events}/reset-password`).send({ temp_password: 'short' })).status).toBe(400);
    expect((await as.admin.post('/api/staff/00000000-0000-0000-0000-000000000000/reset-password').send({ temp_password: 'Temporary-456' })).status).toBe(404);
  });
});
