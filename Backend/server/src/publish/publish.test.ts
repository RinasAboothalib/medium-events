import { join } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setup, signedInAsEveryRole } from '../test/helpers.js';
import { seedEvents } from '../seed.js';
import { buildSnapshot, formatEventDate } from './snapshot.js';

const SITE = 'https://medium.mv';
let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;
let hook: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  hook = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  t = await setup({ fetch: hook as unknown as typeof fetch, config: { publicSiteOrigin: SITE, deployHookUrl: 'https://hooks.example/deploy' } });
  s = await signedInAsEveryRole(t);
});

describe('formatEventDate', () => {
  it('formats one day, ranges within a month, across months and across years', () => {
    expect(formatEventDate('2026-05-12', null)).toBe('Tue, 12 May 2026');
    expect(formatEventDate('2025-04-24', '2025-04-27')).toBe('24 – 27 Apr 2025');
    expect(formatEventDate('2025-04-30', '2025-05-02')).toBe('30 Apr – 2 May 2025');
    expect(formatEventDate('2025-12-30', '2026-01-02')).toBe('30 Dec 2025 – 2 Jan 2026');
    expect(formatEventDate('2025-04-24', '2025-04-24')).toBe('Thu, 24 Apr 2025');
  });
});

describe('buildSnapshot', () => {
  it("matches the website's shapes for the seeded events", async () => {
    await seedEvents(t.db, join(import.meta.dirname, '..', '..', 'seed'));
    const snap = await buildSnapshot(t.db);
    expect(snap.series.map((x) => x.slug)).toEqual(['construction-industry-forum', 'marine-industry-forum', 'aviation-forum', 'build-expo']);
    expect(snap.series[0]).toEqual(
      expect.objectContaining({ name: 'Construction Industry Forum', shortName: 'CIF', series: 'Construction Industry Forum', website: 'https://cif.mv', partners: expect.any(Array) }),
    );
    expect(snap.series[1]).not.toHaveProperty('endorsement');
    expect(snap.events).toHaveLength(9);
    expect(snap.events[0]).toEqual(
      expect.objectContaining({
        name: 'Aviation Forum 2026',
        series: 'Aviation Forum',
        date: 'Tue, 12 May 2026',
        isoDate: '2026-05-12',
        responded: 16,
        image: expect.stringMatching(/^\/api\/public\/files\/[0-9a-f-]{36}$/),
        facebookUrl: 'https://www.facebook.com/events/1592477385417941/',
      }),
    );
    expect(snap.partners.find((p) => p.name === 'MNACI')!.role).toBe('Endorsing association; Official exhibition partner');
    expect(snap.upcoming).toEqual([]);
  });

  it('leaves out inactive series and cancelled editions, and lists upcoming editions separately', async () => {
    const a = (await s.as.admin.post('/api/series').send({ slug: 'a', name: 'A', label: 'A', short_name: 'A' })).body;
    const b = (await s.as.admin.post('/api/series').send({ slug: 'b', name: 'B', label: 'B', short_name: 'B', active: false })).body;
    await s.as.admin.post('/api/editions').send({ series_id: a.id, name: 'A past', start_date: '2025-01-01', status: 'past' });
    await s.as.admin.post('/api/editions').send({ series_id: a.id, name: 'A next', start_date: '2027-01-01', status: 'upcoming' });
    await s.as.admin.post('/api/editions').send({ series_id: a.id, name: 'A off', start_date: '2026-01-01', status: 'cancelled' });
    await s.as.admin.post('/api/editions').send({ series_id: b.id, name: 'B past', start_date: '2025-02-01', status: 'past' });
    const snap = await buildSnapshot(t.db);
    expect(snap.series.map((x) => x.slug)).toEqual(['a']);
    expect(snap.events.map((e) => e.name)).toEqual(['A past']);
    expect(snap.upcoming.map((e) => e.name)).toEqual(['A next']);
    expect(snap.events[0].image).toBe('');
  });
});

describe('publishing', () => {
  it('stores a snapshot, logs it and calls the deploy hook', async () => {
    await seedEvents(t.db, join(import.meta.dirname, '..', '..', 'seed'));
    const res = await s.as.events.post('/api/publish');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ published_at: expect.any(String), series: 4, events: 9, deploy_hook: 'sent' });
    expect(hook).toHaveBeenCalledOnce();
    expect(hook.mock.calls[0][0]).toBe('https://hooks.example/deploy');
    expect(hook.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(await t.db.query("select action from activity_log where entity = 'publish'")).toEqual([{ action: 'publish' }]);
    const latest = await s.as.sales.get('/api/publish/latest');
    expect(latest.body).toEqual({ published_at: res.body.published_at, published_by_name: 'Test events', series: 4, events: 9 });
  });

  it('publishes even when nothing is active, and when the deploy hook fails', async () => {
    hook.mockRejectedValue(new Error('down'));
    const res = await s.as.admin.post('/api/publish');
    expect(res.body).toEqual(expect.objectContaining({ series: 0, events: 0, deploy_hook: 'failed' }));
  });

  it('says nothing has been published yet', async () => {
    expect((await s.as.admin.get('/api/publish/latest')).body).toBeNull();
  });

  it('only lets admins and events staff publish', async () => {
    expect((await s.as.sales.post('/api/publish')).status).toBe(403);
    expect((await s.as.finance.post('/api/publish')).status).toBe(403);
  });
});

describe('public site data', () => {
  it('returns 404 until something is published, then the latest snapshot', async () => {
    const before = await request(t.app).get('/api/public/site-data');
    expect(before.status).toBe(404);
    expect(before.body.error).toBe('Nothing published yet.');
    await seedEvents(t.db, join(import.meta.dirname, '..', '..', 'seed'));
    await s.as.admin.post('/api/publish');
    const res = await request(t.app).get('/api/public/site-data');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(9);
  });

  it('serves only the images the published snapshot uses', async () => {
    await seedEvents(t.db, join(import.meta.dirname, '..', '..', 'seed'));
    const unused = await s.as.admin.post('/api/files?filename=x.png').set('Content-Type', 'image/png').send(Buffer.from([1, 2, 3]));
    await s.as.admin.post('/api/publish');
    const snap = (await request(t.app).get('/api/public/site-data')).body;
    const img = await request(t.app).get(snap.events[0].image);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect((await request(t.app).get(`/api/public/files/${unused.body.id}`)).status).toBe(404);
  });

  it('allows the public website origin only', async () => {
    const ok = await request(t.app).get('/api/public/site-data').set('Origin', SITE);
    expect(ok.headers['access-control-allow-origin']).toBe(SITE);
    const other = await request(t.app).get('/api/public/site-data').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await request(t.app).options('/api/public/enquiries').set('Origin', SITE).set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-methods']).toBe('GET, POST, OPTIONS');
  });
});
