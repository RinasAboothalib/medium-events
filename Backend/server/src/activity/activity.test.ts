import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, setup, signedIn } from '../test/helpers.js';
import { recordActivity } from '../activity.js';

let t: Awaited<ReturnType<typeof setup>>;
let admin: string;
let finance: string;

beforeEach(async () => {
  t = await setup();
  admin = (await createUser(t.db, { role: 'admin', email: 'admin@medium.mv', full_name: 'Aisha Admin' })).id;
  finance = (await createUser(t.db, { role: 'finance', email: 'finance@medium.mv', full_name: 'Fay Finance' })).id;
  await t.db.query('delete from activity_log');
  const at = (iso: string) => new Date(iso);
  await recordActivity(t.db, { actorId: admin, entity: 'users', entityId: finance, action: 'update', changes: { role: { old: 'sales', new: 'finance' } }, at: at('2026-10-01T03:00:00Z') });
  await recordActivity(t.db, { actorId: finance, entity: 'users', entityId: finance, action: 'update', changes: { password: 'changed' }, at: at('2026-10-05T20:00:00Z') });
  await recordActivity(t.db, { actorId: null, entity: 'users', entityId: admin, action: 'create', at: at('2026-09-30T02:00:00Z') });
});

describe('GET /api/activity', () => {
  it('shows admins everything, newest first, with names', async () => {
    const res = await (await signedIn(t.app, 'admin@medium.mv')).get('/api/activity');
    expect(res.status).toBe(200);
    const rows = res.body.rows.filter((r: { action: string }) => r.action !== 'login');
    expect(rows.map((r: { actor_name: string | null }) => r.actor_name)).toEqual(['Fay Finance', 'Aisha Admin', null]);
    expect(res.body.total).toBe(res.body.rows.length);
  });

  it('shows everyone else only their own changes, whatever they ask for', async () => {
    const agent = await signedIn(t.app, 'finance@medium.mv');
    const res = await agent.get(`/api/activity?actor=${admin}`);
    expect(res.body.rows.every((r: { actor_id: string }) => r.actor_id === finance)).toBe(true);
  });

  it('filters by action and Maldives calendar dates', async () => {
    const agent = await signedIn(t.app, 'admin@medium.mv');
    // 2026-10-05T20:00Z is 6 October in the Maldives (UTC+5)
    const res = await agent.get('/api/activity?action=update&from=2026-10-06&to=2026-10-06');
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].actor_id).toBe(finance);
  });

  it('pages 50 at a time', async () => {
    for (let i = 0; i < 60; i++) {
      await recordActivity(t.db, { actorId: admin, entity: 'users', entityId: admin, action: 'update', at: new Date(Date.UTC(2026, 8, 1, 0, i)) });
    }
    const agent = await signedIn(t.app, 'admin@medium.mv');
    const first = await agent.get('/api/activity');
    const second = await agent.get('/api/activity?page=1');
    expect(first.body.rows).toHaveLength(50);
    expect(second.body.rows.length).toBe(first.body.total - 50);
  });

  it('rejects bad filters', async () => {
    const agent = await signedIn(t.app, 'admin@medium.mv');
    expect((await agent.get('/api/activity?from=yesterday')).status).toBe(400);
  });
});
