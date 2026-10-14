import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PASSWORD, createUser, setup, signedIn } from '../test/helpers.js';
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, ensureDefaultAdmin } from '../bootstrap.js';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  t = await setup();
});

const MIN = 60_000;
const HOUR = 60 * MIN;

describe('default admin', () => {
  it('is created once, on an empty database, and must change its password', async () => {
    expect(await ensureDefaultAdmin(t.db)).toBe('created');
    expect(await ensureDefaultAdmin(t.db)).toBe('exists');
    const users = await t.db.query<{ email: string; role: string; must_change_password: boolean }>('select email, role, must_change_password from users');
    expect(users).toEqual([{ email: 'admin@medium.mv', role: 'admin', must_change_password: true }]);
    expect(DEFAULT_ADMIN_EMAIL).toBe('admin@medium.mv');
    expect(DEFAULT_ADMIN_PASSWORD).toBe('Medium@2026!');
  });

  it('uses the configured password when given', async () => {
    await ensureDefaultAdmin(t.db, 'Configured-Pass-1');
    expect((await request(t.app).post('/api/auth/login').send({ email: 'admin@medium.mv', password: 'Configured-Pass-1' })).status).toBe(200);
  });

  it('signs in, then must change its password before doing anything else', async () => {
    await ensureDefaultAdmin(t.db);
    const agent = await signedIn(t.app, 'admin@medium.mv', 'Medium@2026!');
    const me = await agent.get('/api/auth/me');
    expect(me.body).toMatchObject({ email: 'admin@medium.mv', role: 'admin', must_change_password: true });
    expect(me.body.password_hash).toBeUndefined();
    const blocked = await agent.get('/api/staff');
    expect(blocked.status).toBe(403);
    expect(blocked.body).toEqual({ error: 'password_change_required' });
  });
});

describe('login', () => {
  it('sets an http-only session cookie and records the sign-in', async () => {
    const user = await createUser(t.db, { email: 'sam@medium.mv', role: 'sales' });
    const res = await request(t.app).post('/api/auth/login').send({ email: 'sam@medium.mv', password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^medium_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    // The browser keeps the cookie for the 30-day maximum; the server ends idle sessions after 8 hours
    expect(cookie).toMatch(/Max-Age=2592000;/);
    const log = await t.db.query('select actor_id, action from activity_log');
    expect(log).toEqual([{ actor_id: user.id, action: 'login' }]);
  });

  it('accepts the email in any case and with spaces', async () => {
    await createUser(t.db, { email: 'admin@medium.mv' });
    expect((await request(t.app).post('/api/auth/login').send({ email: '  Admin@Medium.MV ', password: PASSWORD })).status).toBe(200);
  });

  it('gives the same answer for an unknown email, a wrong password and a deactivated user', async () => {
    await createUser(t.db, { email: 'on@medium.mv' });
    await createUser(t.db, { email: 'off@medium.mv', active: false });
    const answers = await Promise.all([
      request(t.app).post('/api/auth/login').send({ email: 'nobody@medium.mv', password: PASSWORD }),
      request(t.app).post('/api/auth/login').send({ email: 'on@medium.mv', password: 'wrong-password' }),
      request(t.app).post('/api/auth/login').send({ email: 'off@medium.mv', password: PASSWORD }),
    ]);
    for (const res of answers) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Email or password is incorrect.' });
    }
  });

  it('locks an email for 15 minutes after 5 failed attempts', async () => {
    await createUser(t.db, { email: 'sam@medium.mv' });
    for (let i = 0; i < 5; i++) await request(t.app).post('/api/auth/login').send({ email: 'sam@medium.mv', password: 'wrong' });
    const locked = await request(t.app).post('/api/auth/login').send({ email: 'sam@medium.mv', password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body).toEqual({ error: 'Too many attempts. Try again in 15 minutes.' });
    t.advance(15 * MIN + 1000);
    expect((await request(t.app).post('/api/auth/login').send({ email: 'sam@medium.mv', password: PASSWORD })).status).toBe(200);
  });

  it('rejects a missing or malformed body', async () => {
    expect((await request(t.app).post('/api/auth/login').send({})).status).toBe(400);
  });
});

describe('sessions', () => {
  it('needs a session for /me', async () => {
    expect((await request(t.app).get('/api/auth/me')).status).toBe(401);
  });

  it('expire after 8 hours without activity', async () => {
    await createUser(t.db, { email: 'sam@medium.mv' });
    const agent = await signedIn(t.app, 'sam@medium.mv');
    t.advance(7 * HOUR);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    t.advance(7 * HOUR); // active 7 h ago, so still within 8 h of last use
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    t.advance(8 * HOUR + MIN);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('expire 30 days after sign-in even when used', async () => {
    await createUser(t.db, { email: 'sam@medium.mv' });
    const agent = await signedIn(t.app, 'sam@medium.mv');
    // Used every 4 hours (never idle long enough to expire) for just under 30 days
    for (let i = 0; i < 179; i++) {
      t.advance(4 * HOUR);
      expect((await agent.get('/api/auth/me')).status).toBe(200);
    }
    t.advance(4 * HOUR); // now exactly 30 days after sign-in
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('end on logout', async () => {
    await createUser(t.db, { email: 'sam@medium.mv' });
    const agent = await signedIn(t.app, 'sam@medium.mv');
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('change password', () => {
  beforeEach(async () => {
    await createUser(t.db, { email: 'sam@medium.mv', must_change_password: true });
  });

  it('checks the current password, length and that it actually changes', async () => {
    const agent = await signedIn(t.app, 'sam@medium.mv');
    const wrong = await agent.post('/api/auth/change-password').send({ current_password: 'nope', new_password: 'New-Password-1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('Your current password is incorrect.');
    const short = await agent.post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: 'short' });
    expect(short.body.error).toBe('Use at least 10 characters.');
    const same = await agent.post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: PASSWORD });
    expect(same.body.error).toBe('Choose a password different from your current one.');
  });

  it('clears the flag, keeps this session and ends the others', async () => {
    const mine = await signedIn(t.app, 'sam@medium.mv');
    const other = await signedIn(t.app, 'sam@medium.mv');
    const res = await mine.post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: 'New-Password-1' });
    expect(res.status).toBe(204);
    expect((await mine.get('/api/auth/me')).body.must_change_password).toBe(false);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await request(t.app).post('/api/auth/login').send({ email: 'sam@medium.mv', password: 'New-Password-1' })).status).toBe(200);
  });
});
