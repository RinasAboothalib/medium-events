import { beforeEach, describe, expect, it } from 'vitest';
import { ROLE_LIST, createUser, setup, signedInAsEveryRole } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;
let editionId: string;
let otherEditionId: string;

beforeEach(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
  const series = (await s.as.admin.post('/api/series').send({ slug: 'cif', name: 'CIF', label: 'CIF', short_name: 'CIF' })).body;
  editionId = (await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2026', start_date: '2026-11-01' })).body.id;
  otherEditionId = (await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2027', start_date: '2027-11-01' })).body.id;
});

async function task(overrides: Record<string, unknown> = {}) {
  const res = await s.as.events.post('/api/tasks').send({ edition_id: editionId, title: 'Book the hall', ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

describe('tasks', () => {
  it('creates a task with defaults and lets every role read it', async () => {
    const created = await s.as.events.post('/api/tasks').send({ edition_id: editionId, title: '  Book the hall ', due_date: '2026-10-20', assignee_id: s.ids.sales });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({ title: 'Book the hall', edition_name: 'CIF 2026', status: 'todo', due_date: '2026-10-20', assignee_name: 'Test sales', notes: '', completed_at: null }),
    );
    for (const role of ROLE_LIST) {
      const list = await s.as[role].get(`/api/tasks?edition_id=${editionId}`);
      expect(list.status).toBe(200);
      expect(list.body.map((x: { title: string }) => x.title)).toEqual(['Book the hall']);
      expect((await s.as[role].get(`/api/tasks/${created.body.id}`)).status).toBe(200);
    }
  });

  it('only lets admins and the events team change tasks', async () => {
    const { id } = await task();
    for (const role of ['sales', 'finance'] as const) {
      expect((await s.as[role].post('/api/tasks').send({ edition_id: editionId, title: 'x' })).status).toBe(403);
      expect((await s.as[role].patch(`/api/tasks/${id}`).send({ status: 'done' })).status).toBe(403);
      expect((await s.as[role].delete(`/api/tasks/${id}`)).status).toBe(403);
    }
    expect((await s.as.admin.delete(`/api/tasks/${id}`)).status).toBe(204);
    expect((await s.as.admin.get(`/api/tasks/${id}`)).status).toBe(404);
  });

  it('checks the title, edition, date and assignee', async () => {
    const missing = await s.as.admin.post('/api/tasks').send({ edition_id: editionId, title: ' ', due_date: 'tomorrow' });
    expect(missing.status).toBe(400);
    expect(missing.body.fields).toEqual({ title: 'Enter what needs doing.', due_date: 'Use a date like 2026-10-31.' });
    const noEdition = await s.as.admin.post('/api/tasks').send({ edition_id: '00000000-0000-0000-0000-000000000000', title: 'x' });
    expect(noEdition.body.fields).toEqual({ edition_id: 'Choose an edition.' });
    const inactive = await createUser(t.db, { email: 'gone@medium.mv', role: 'events', active: false });
    const badAssignee = await s.as.admin.post('/api/tasks').send({ edition_id: editionId, title: 'x', assignee_id: inactive.id });
    expect(badAssignee.status).toBe(400);
    expect(badAssignee.body.fields).toEqual({ assignee_id: 'Choose an active member of staff.' });
  });

  it('stamps the finish time when a task is done and clears it when reopened', async () => {
    const { id } = await task();
    const done = await s.as.events.patch(`/api/tasks/${id}`).send({ status: 'done' });
    expect(done.body).toEqual(expect.objectContaining({ status: 'done', completed_at: '2026-10-13T04:00:00.000Z' }));
    const reopened = await s.as.events.patch(`/api/tasks/${id}`).send({ status: 'in_progress', notes: 'Waiting for the venue.' });
    expect(reopened.body).toEqual(expect.objectContaining({ status: 'in_progress', completed_at: null, notes: 'Waiting for the venue.' }));
    // A task can't be moved to another edition
    expect((await s.as.events.patch(`/api/tasks/${id}`).send({ edition_id: otherEditionId })).body.edition_id).toBe(editionId);
  });

  it('filters by edition, status and assignee, with unfinished work first by due date', async () => {
    await task({ title: 'Later', due_date: '2026-10-30' });
    await task({ title: 'Sooner', due_date: '2026-10-15', assignee_id: s.ids.events });
    await task({ title: 'No date' });
    await task({ title: 'Finished', due_date: '2026-10-01', status: 'done' });
    await task({ title: 'Elsewhere', edition_id: otherEditionId });
    const titles = async (query: string) => (await s.as.events.get(`/api/tasks?${query}`)).body.map((x: { title: string }) => x.title);
    expect(await titles(`edition_id=${editionId}`)).toEqual(['Sooner', 'Later', 'No date', 'Finished']);
    expect(await titles(`edition_id=${editionId}&status=done`)).toEqual(['Finished']);
    expect(await titles('assignee=me')).toEqual(['Sooner']);
    expect(await titles(`assignee=${s.ids.sales}`)).toEqual([]);
    expect(await titles('')).toHaveLength(5);
  });

  it('logs changes and goes when its edition is deleted', async () => {
    const { id } = await task();
    await s.as.events.patch(`/api/tasks/${id}`).send({ status: 'done' });
    await s.as.events.patch(`/api/tasks/${id}`).send({ status: 'done' });
    const log = await t.db.query("select action, changes from activity_log where entity = 'tasks' order by id");
    expect(log).toEqual([
      { action: 'create', changes: { title: 'Book the hall', edition_id: editionId } },
      { action: 'update', changes: { status: { old: 'todo', new: 'done' } } },
    ]);
    expect((await s.as.admin.delete(`/api/editions/${editionId}`)).status).toBe(204);
    expect((await s.as.admin.get(`/api/tasks/${id}`)).status).toBe(404);
  });
});
