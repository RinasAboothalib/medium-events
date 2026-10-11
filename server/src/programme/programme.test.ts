import { beforeEach, describe, expect, it } from 'vitest';
import { ROLE_LIST, setup, signedInAsEveryRole } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;
let editionId: string;
let otherEditionId: string;

// A two-day edition, 1–2 November 2026
beforeEach(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
  const series = (await s.as.admin.post('/api/series').send({ slug: 'cif', name: 'CIF', label: 'CIF', short_name: 'CIF' })).body;
  editionId = (await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2026', start_date: '2026-11-01', end_date: '2026-11-02' })).body.id;
  otherEditionId = (await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2027', start_date: '2027-11-01' })).body.id;
});

async function speaker(full_name: string, overrides: Record<string, unknown> = {}) {
  const res = await s.as.events.post('/api/speakers').send({ edition_id: editionId, full_name, ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

async function session(overrides: Record<string, unknown> = {}) {
  const res = await s.as.events.post('/api/sessions').send({ edition_id: editionId, title: 'Opening keynote', day: '2026-11-01', start_time: '09:00', ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string; speakers: { id: string; full_name: string }[] };
}

describe('speakers', () => {
  it('adds, edits and lists speakers of an edition for every role', async () => {
    const created = await s.as.events.post('/api/speakers').send({ edition_id: editionId, full_name: 'Aminath Shauna', job_title: 'Minister', organisation: 'Ministry of Construction' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ full_name: 'Aminath Shauna', job_title: 'Minister', bio: '', sort_order: 0, session_count: 0 }));
    await speaker('Elsewhere', { edition_id: otherEditionId });
    const patched = await s.as.admin.patch(`/api/speakers/${created.body.id}`).send({ bio: 'Twenty years in the industry.' });
    expect(patched.body.bio).toBe('Twenty years in the industry.');
    for (const role of ROLE_LIST) {
      const list = await s.as[role].get(`/api/speakers?edition_id=${editionId}`);
      expect(list.body.map((x: { full_name: string }) => x.full_name)).toEqual(['Aminath Shauna']);
    }
    for (const role of ['sales', 'finance'] as const) {
      expect((await s.as[role].post('/api/speakers').send({ edition_id: editionId, full_name: 'x' })).status).toBe(403);
      expect((await s.as[role].delete(`/api/speakers/${created.body.id}`)).status).toBe(403);
    }
    const bad = await s.as.admin.post('/api/speakers').send({ edition_id: editionId, full_name: '' });
    expect(bad.body.fields).toEqual({ full_name: "Enter the speaker's name." });
  });
});

describe('sessions', () => {
  it('creates sessions with speakers and lists the programme in running order', async () => {
    const a = await speaker('Aminath Shauna', { sort_order: 2 });
    const b = await speaker('Hassan Ali', { sort_order: 1 });
    await session({ title: 'Panel: financing', day: '2026-11-02', start_time: '10:30', end_time: '11:30', kind: 'panel', room: 'Hall B', speaker_ids: [a.id, b.id] });
    await session({ title: 'Coffee', start_time: '10:00', kind: 'break' });
    const keynote = await session({ speaker_ids: [a.id] });
    expect(keynote).toEqual(expect.objectContaining({ kind: 'presentation', end_time: null, room: '', speakers: [{ id: a.id, full_name: 'Aminath Shauna' }] }));

    const list = await s.as.finance.get(`/api/sessions?edition_id=${editionId}`);
    expect(list.body.map((x: { day: string; start_time: string; title: string }) => `${x.day} ${x.start_time} ${x.title}`)).toEqual([
      '2026-11-01 09:00 Opening keynote',
      '2026-11-01 10:00 Coffee',
      '2026-11-02 10:30 Panel: financing',
    ]);
    // Speakers come in their own order
    expect(list.body[2].speakers.map((x: { full_name: string }) => x.full_name)).toEqual(['Hassan Ali', 'Aminath Shauna']);
    expect((await s.as.events.get(`/api/speakers?edition_id=${editionId}`)).body.find((x: { id: string }) => x.id === a.id).session_count).toBe(2);
  });

  it('keeps sessions inside the edition and their times in order', async () => {
    const post = (body: Record<string, unknown>) => s.as.admin.post('/api/sessions').send({ edition_id: editionId, title: 'X', day: '2026-11-01', start_time: '09:00', ...body });
    expect((await post({ day: '2026-11-03' })).body.fields).toEqual({ day: 'Choose a day during CIF 2026.' });
    expect((await post({ end_time: '08:30' })).body.fields).toEqual({ end_time: 'The end time must be after the start time.' });
    expect((await post({ start_time: '9am' })).body.fields).toEqual({ start_time: 'Use a time like 09:30.' });
    expect((await post({ kind: 'party' })).body.fields).toEqual({ kind: 'Choose a session type.' });
    const outsider = await speaker('From another year', { edition_id: otherEditionId });
    expect((await post({ speaker_ids: [outsider.id] })).body.fields).toEqual({ speaker_ids: 'Choose speakers from this edition.' });
    expect((await s.as.admin.get(`/api/sessions?edition_id=${editionId}`)).body).toEqual([]);

    const { id } = await session({ end_time: '10:00' });
    expect((await s.as.admin.patch(`/api/sessions/${id}`).send({ start_time: '10:30' })).body.fields).toEqual({ end_time: 'The end time must be after the start time.' });
    expect((await s.as.admin.patch(`/api/sessions/${id}`).send({ day: '2026-10-31' })).status).toBe(400);
    expect((await s.as.admin.patch(`/api/sessions/${id}`).send({ start_time: '09:15', end_time: null })).body).toEqual(expect.objectContaining({ start_time: '09:15', end_time: null }));
  });

  it('changes the speakers of a session and logs it', async () => {
    const a = await speaker('Aminath Shauna');
    const b = await speaker('Hassan Ali');
    const { id } = await session({ speaker_ids: [a.id] });
    const patched = await s.as.events.patch(`/api/sessions/${id}`).send({ room: 'Main hall', speaker_ids: [b.id] });
    expect(patched.body).toEqual(expect.objectContaining({ room: 'Main hall', speakers: [{ id: b.id, full_name: 'Hassan Ali' }] }));
    // Sending the same again changes nothing and logs nothing
    await s.as.events.patch(`/api/sessions/${id}`).send({ room: 'Main hall', speaker_ids: [b.id] });
    const log = await t.db.query("select action, changes from activity_log where entity = 'programme_sessions' order by id");
    expect(log).toEqual([
      { action: 'create', changes: { title: 'Opening keynote', day: '2026-11-01', start_time: '09:00' } },
      { action: 'update', changes: { room: { old: '', new: 'Main hall' }, speaker_ids: { old: [a.id], new: [b.id] } } },
    ]);
    expect((await s.as.sales.patch(`/api/sessions/${id}`).send({ room: 'x' })).status).toBe(403);
  });

  it('takes a removed speaker off their sessions, and removes sessions', async () => {
    const a = await speaker('Aminath Shauna');
    const { id } = await session({ speaker_ids: [a.id] });
    expect((await s.as.events.delete(`/api/speakers/${a.id}`)).status).toBe(204);
    expect((await s.as.events.get(`/api/sessions?edition_id=${editionId}`)).body[0].speakers).toEqual([]);
    expect((await s.as.events.delete(`/api/sessions/${id}`)).status).toBe(204);
    expect((await s.as.events.delete(`/api/sessions/${id}`)).status).toBe(404);
  });
});
