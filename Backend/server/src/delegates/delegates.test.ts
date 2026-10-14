import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { setup, signedInAsEveryRole } from '../test/helpers.js';

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

async function delegate(full_name: string, overrides: Record<string, unknown> = {}) {
  const res = await s.as.events.post('/api/delegates').send({ edition_id: editionId, full_name, ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

// supertest: collect binary bodies as Buffers
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('delegates', () => {
  it('registers a delegate; sales can look people up but not change them; finance sees nothing', async () => {
    const created = await s.as.events.post('/api/delegates').send({ edition_id: editionId, full_name: ' Mariyam Ali ', company: 'Island Builders', email: 'Mariyam@Island.MV ', category: 'vip' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({ full_name: 'Mariyam Ali', email: 'mariyam@island.mv', category: 'vip', status: 'registered', checked_in_at: null, edition_name: 'CIF 2026' }),
    );
    const { id } = created.body;
    expect((await s.as.sales.get(`/api/delegates?edition_id=${editionId}`)).body.rows).toHaveLength(1);
    expect((await s.as.sales.get(`/api/delegates/${id}`)).status).toBe(200);
    expect((await s.as.sales.patch(`/api/delegates/${id}`).send({ status: 'confirmed' })).status).toBe(403);
    expect((await s.as.sales.post(`/api/delegates/${id}/check-in`)).status).toBe(403);
    expect((await s.as.finance.get('/api/delegates')).status).toBe(403);
    expect((await s.as.finance.get(`/api/delegates/${id}`)).status).toBe(403);
  });

  it('checks the fields and refuses the same email twice for one event', async () => {
    const bad = await s.as.admin.post('/api/delegates').send({ edition_id: editionId, full_name: '', email: 'not-an-email', category: 'royalty' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toEqual({ full_name: "Enter the person's name.", email: 'Enter a valid email address.', category: 'Choose a category.' });

    const first = await delegate('Mariyam Ali', { email: 'm@island.mv' });
    const dup = await s.as.admin.post('/api/delegates').send({ edition_id: editionId, full_name: 'M. Ali', email: 'M@ISLAND.MV' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('Someone with that email is already registered for this event.');
    // The same person at another edition, and people without an email, are fine
    await delegate('Mariyam Ali', { email: 'm@island.mv', edition_id: otherEditionId });
    await delegate('No Email One');
    const second = await delegate('No Email Two');
    expect((await s.as.admin.patch(`/api/delegates/${second.id}`).send({ email: 'm@island.mv' })).status).toBe(409);
    expect((await s.as.admin.patch(`/api/delegates/${first.id}`).send({ email: 'm@island.mv', phone: '7771234' })).body.phone).toBe('7771234');
  });

  it('checks people in at the door, once, and can undo it', async () => {
    const { id } = await delegate('Mariyam Ali', { status: 'confirmed' });
    const checked = await s.as.events.post(`/api/delegates/${id}/check-in`);
    expect(checked.status).toBe(200);
    expect(checked.body).toEqual(expect.objectContaining({ status: 'attended', checked_in_at: '2026-10-13T04:00:00.000Z' }));
    const again = await s.as.events.post(`/api/delegates/${id}/check-in`);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('Mariyam Ali is already checked in.');

    const undone = await s.as.events.delete(`/api/delegates/${id}/check-in`);
    expect(undone.body).toEqual(expect.objectContaining({ status: 'confirmed', checked_in_at: null }));
    expect((await s.as.events.delete(`/api/delegates/${id}/check-in`)).status).toBe(409);

    const cancelled = await delegate('Hassan Cancelled', { status: 'cancelled' });
    const refused = await s.as.events.post(`/api/delegates/${cancelled.id}/check-in`);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe('This registration is cancelled. Change its status first.');

    // Changing the status by hand keeps the check-in time in step
    t.advance(60_000);
    expect((await s.as.events.patch(`/api/delegates/${id}`).send({ status: 'attended' })).body.checked_in_at).toBe('2026-10-13T04:01:00.000Z');
    expect((await s.as.events.patch(`/api/delegates/${id}`).send({ status: 'no_show' })).body.checked_in_at).toBeNull();
    const log = await t.db.query<{ changes: Record<string, unknown> }>("select changes from activity_log where entity = 'delegates' and entity_id = $1 order by id", [id]);
    expect(log.map((l) => l.changes)[1]).toEqual({ checked_in: true, status: { old: 'confirmed', new: 'attended' } });
  });

  it('searches, filters, pages and counts the register', async () => {
    await delegate('Aishath Zara', { company: 'Coral Homes', category: 'speaker', status: 'confirmed' });
    await delegate('Bilal Naseem', { company: 'Island Builders', status: 'attended' });
    await delegate('Cara 100%', { status: 'cancelled' });
    await delegate('Elsewhere', { edition_id: otherEditionId });
    const list = async (query: string) => (await s.as.events.get(`/api/delegates?edition_id=${editionId}&${query}`)).body;

    const all = await list('');
    expect(all.rows.map((x: { full_name: string }) => x.full_name)).toEqual(['Aishath Zara', 'Bilal Naseem', 'Cara 100%']);
    expect(all.total).toBe(3);
    expect(all.summary).toEqual({ total: 3, checked_in: 1, by_status: { invited: 0, registered: 0, confirmed: 1, attended: 1, cancelled: 1, no_show: 0 } });

    expect((await list('q=island')).rows.map((x: { full_name: string }) => x.full_name)).toEqual(['Bilal Naseem']);
    // % and _ are searched for literally
    expect((await list('q=100%25')).total).toBe(1);
    expect((await list('q=%25')).total).toBe(1);
    const speakers = await list('category=speaker');
    expect(speakers.total).toBe(1);
    // The summary still covers the whole edition
    expect(speakers.summary.total).toBe(3);
    expect((await list('status=cancelled')).rows[0].full_name).toBe('Cara 100%');
    expect((await list('page=1')).rows).toEqual([]);
    expect((await s.as.events.get('/api/delegates')).body.total).toBe(4);
  });

  it("keeps an edition that has delegates, and removes delegates one at a time", async () => {
    const { id } = await delegate('Mariyam Ali');
    const refused = await s.as.admin.delete(`/api/editions/${editionId}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe('This edition has delegates on its register. Cancel it instead, or remove them first.');
    expect((await s.as.events.delete(`/api/delegates/${id}`)).status).toBe(204);
    expect((await s.as.admin.delete(`/api/editions/${editionId}`)).status).toBe(204);
  });

  it('exports the register to Excel for admin and the events team, and shows it in the post-event report', async () => {
    const a = await delegate('Aishath Zara', { company: 'Coral Homes', category: 'speaker' });
    await delegate('Bilal Naseem', { status: 'cancelled' });
    await delegate('Elsewhere', { edition_id: otherEditionId });
    await s.as.events.post(`/api/delegates/${a.id}/check-in`);

    const res = await s.as.events.get(`/api/reports/delegates.xlsx?edition_id=${editionId}`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="delegates-report.xlsx"');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Delegates')!;
    const row = (n: number) => (sheet.getRow(n).values as unknown[]).slice(1);
    expect(row(1)).toEqual(['Event', 'Name', 'Company', 'Job title', 'Email', 'Phone', 'Category', 'Status', 'Checked in', 'Notes']);
    expect(row(2).slice(0, 3)).toEqual(['CIF 2026', 'Aishath Zara', 'Coral Homes']);
    expect(row(2).slice(6, 8)).toEqual(['Speaker', 'Attended']);
    // 04:00 UTC is 09:00 in the Maldives
    expect((row(2)[8] as Date).toISOString()).toBe('2026-10-13T09:00:00.000Z');
    expect(sheet.rowCount).toBe(3);

    expect((await s.as.sales.get('/api/reports/delegates.xlsx')).status).toBe(403);
    const [logged] = await t.db.query<{ changes: unknown }>("select changes from activity_log where action = 'export'");
    expect(logged.changes).toEqual({ report: 'delegates', filters: { edition_id: editionId } });
    expect((await s.as.events.get(`/api/reports/post-event/${editionId}.pdf`)).status).toBe(200);
  });
});
