import { beforeEach, describe, expect, it } from 'vitest';
import { JPEG, ROLE_LIST, setup, signedInAsEveryRole } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;

beforeEach(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
});

const newSeries = {
  slug: 'tourism-forum',
  name: 'Maldives Tourism Forum',
  label: 'Tourism Forum',
  short_name: 'MTF',
  tagline: 'Tourism leaders meet.',
  description: ['First paragraph.', 'Second paragraph.'],
  audience: 'Tourism industry',
  usual_venue: 'Malé',
  usual_month: 'March',
};

async function createSeries(overrides: Record<string, unknown> = {}) {
  const res = await s.as.admin.post('/api/series').send({ ...newSeries, ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

async function createEdition(seriesId: string, overrides: Record<string, unknown> = {}) {
  const res = await s.as.events
    .post('/api/editions')
    .send({ series_id: seriesId, name: 'MTF 2027', start_date: '2027-03-10', venue: 'JEN Malé', ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

describe('series', () => {
  it('creates a series with defaults and lists it for every role', async () => {
    const created = await createSeries();
    expect(created).toEqual(
      expect.objectContaining({ slug: 'tourism-forum', label: 'Tourism Forum', description: ['First paragraph.', 'Second paragraph.'], active: true, edition_count: 0, website: null }),
    );
    for (const role of ROLE_LIST) {
      const res = await s.as[role].get('/api/series');
      expect(res.status).toBe(200);
      expect(res.body.map((x: { slug: string }) => x.slug)).toEqual(['tourism-forum']);
    }
  });

  it('only lets admins and events staff change series', async () => {
    const { id } = await createSeries();
    for (const role of ['sales', 'finance'] as const) {
      expect((await s.as[role].post('/api/series').send({ ...newSeries, slug: 'other' })).status).toBe(403);
      expect((await s.as[role].patch(`/api/series/${id}`).send({ tagline: 'x' })).status).toBe(403);
      expect((await s.as[role].delete(`/api/series/${id}`)).status).toBe(403);
    }
    expect((await s.as.events.patch(`/api/series/${id}`).send({ tagline: 'New tagline' })).body.tagline).toBe('New tagline');
  });

  it('checks the web address format and uniqueness', async () => {
    await createSeries();
    const bad = await s.as.admin.post('/api/series').send({ ...newSeries, slug: 'Tourism Forum!' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.slug).toBe('Use lower-case letters, numbers and dashes only.');
    const dup = await s.as.admin.post('/api/series').send(newSeries);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('That web address is already used by another series.');
  });

  it('logs changes with a diff', async () => {
    const { id } = await createSeries();
    await s.as.admin.patch(`/api/series/${id}`).send({ active: false });
    const log = await t.db.query("select action, changes from activity_log where entity = 'event_series' order by id");
    expect(log).toEqual([
      { action: 'create', changes: expect.objectContaining({ slug: 'tourism-forum' }) },
      { action: 'update', changes: { active: { old: true, new: false } } },
    ]);
  });

  it("refuses to delete a series that still has editions", async () => {
    const { id } = await createSeries();
    const edition = await createEdition(id);
    const res = await s.as.admin.delete(`/api/series/${id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Remove this series' editions first.");
    await s.as.admin.delete(`/api/editions/${edition.id}`);
    expect((await s.as.admin.delete(`/api/series/${id}`)).status).toBe(204);
    expect((await s.as.admin.get(`/api/series/${id}`)).status).toBe(404);
  });
});

describe('editions', () => {
  it('creates, reads and updates an edition', async () => {
    const { id: seriesId } = await createSeries();
    const created = await createEdition(seriesId);
    expect(created).toEqual(
      expect.objectContaining({ series_name: 'Maldives Tourism Forum', start_date: '2027-03-10', end_date: null, status: 'upcoming', rsvp_count: null, outcome_notes: '' }),
    );
    const patched = await s.as.events.patch(`/api/editions/${created.id}`).send({ status: 'past', attendance: 240, outcome_notes: 'Full house.' });
    expect(patched.status).toBe(200);
    expect(patched.body).toEqual(expect.objectContaining({ status: 'past', attendance: 240, outcome_notes: 'Full house.' }));
  });

  it('refuses an end date before the start date', async () => {
    const { id: seriesId } = await createSeries();
    const res = await s.as.admin.post('/api/editions').send({ series_id: seriesId, name: 'X', start_date: '2027-03-10', end_date: '2027-03-09' });
    expect(res.status).toBe(400);
    expect(res.body.fields.end_date).toBe('The end date must be on or after the start date.');
  });

  it('lists editions of one series, newest first', async () => {
    const a = await createSeries();
    const b = await createSeries({ slug: 'other-forum', name: 'Other' });
    await createEdition(a.id, { name: 'Old', start_date: '2025-01-01' });
    await createEdition(a.id, { name: 'New', start_date: '2027-01-01' });
    await createEdition(b.id, { name: 'Elsewhere', start_date: '2026-01-01' });
    const res = await s.as.finance.get(`/api/editions?series_id=${a.id}`);
    expect(res.body.map((e: { name: string }) => e.name)).toEqual(['New', 'Old']);
    expect((await s.as.finance.get('/api/editions')).body).toHaveLength(3);
  });

  it('only lets admins and events staff change editions', async () => {
    const { id: seriesId } = await createSeries();
    const { id } = await createEdition(seriesId);
    expect((await s.as.sales.patch(`/api/editions/${id}`).send({ name: 'x' })).status).toBe(403);
    expect((await s.as.finance.delete(`/api/editions/${id}`)).status).toBe(403);
  });

  it('refuses a banner id that is not an uploaded file', async () => {
    const { id: seriesId } = await createSeries();
    const res = await s.as.admin
      .post('/api/editions')
      .send({ series_id: seriesId, name: 'X', start_date: '2027-03-10', banner_file_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
    expect(res.body.fields.banner_file_id).toBe('Upload the banner again.');
  });
});

describe('partners', () => {
  it('adds, edits and removes partners on a series or an edition', async () => {
    const { id: seriesId } = await createSeries();
    const { id: editionId } = await createEdition(seriesId);
    const p = await s.as.events.post('/api/partners').send({ name: 'SITA', role: 'Sponsor', edition_id: editionId });
    expect(p.status).toBe(201);
    await s.as.events.post('/api/partners').send({ name: 'MNACI', role: 'Endorsing association', series_id: seriesId });
    expect((await s.as.sales.get(`/api/partners?edition_id=${editionId}`)).body.map((x: { name: string }) => x.name)).toEqual(['SITA']);
    expect((await s.as.events.patch(`/api/partners/${p.body.id}`).send({ role: 'Gold sponsor' })).body.role).toBe('Gold sponsor');
    expect((await s.as.events.delete(`/api/partners/${p.body.id}`)).status).toBe(204);
  });

  it('needs a series or an edition', async () => {
    const res = await s.as.admin.post('/api/partners').send({ name: 'Nobody' });
    expect(res.status).toBe(400);
    expect(res.body.fields.series_id).toBe('Choose a series or an edition.');
  });
});

describe('banners in use', () => {
  it('refuses to delete an image still used as a banner', async () => {
    const file = await s.as.admin.post('/api/files?filename=b.jpg').set('Content-Type', 'image/jpeg').send(JPEG);
    const { id: seriesId } = await createSeries();
    await createEdition(seriesId, { banner_file_id: file.body.id });
    const res = await s.as.admin.delete(`/api/files/${file.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This image is used as an event banner.');
  });
});
