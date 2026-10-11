import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { JPEG, setup, signedInAsEveryRole } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;
let editionId: string;
let otherEditionId: string;

// supertest: collect binary bodies as Buffers
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

async function workbook(body: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(body as unknown as ArrayBuffer);
  return wb;
}

beforeEach(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
  const banner = await s.as.admin.post('/api/files?filename=b.jpg').set('Content-Type', 'image/jpeg').send(JPEG);
  const series = (await s.as.admin.post('/api/series').send({ slug: 'cif', name: 'Construction Industry Forum', label: 'CIF', short_name: 'CIF' })).body;
  editionId = (
    await s.as.admin.post('/api/editions').send({
      series_id: series.id,
      name: 'CIF 2026',
      start_date: '2026-09-01',
      venue: 'JEN Malé',
      status: 'past',
      rsvp_count: 220,
      attendance: 180,
      outcome_notes: 'Full house.',
      banner_file_id: banner.body.id,
    })
  ).body.id;
  otherEditionId = (await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2025', start_date: '2025-09-01' })).body.id;
  await s.as.events.post('/api/partners').send({ name: 'MNACI', role: 'Endorsing association', edition_id: editionId });

  const sponsor = async (company: string) => (await s.as.sales.post('/api/sponsors').send({ company })).body.id as string;
  const deal = async (sponsorId: string, edition: string, amount: number, currency: string, status: string) =>
    (await s.as.sales.post('/api/deals').send({ sponsor_id: sponsorId, edition_id: edition, package: `Pkg ${amount}`, amount, currency, status })).body.id as string;
  const ooredoo = await sponsor('Ooredoo Maldives');
  const sita = await sponsor('SITA');
  const d1 = await deal(ooredoo, editionId, 100000, 'MVR', 'confirmed');
  await deal(sita, editionId, 50000, 'MVR', 'proposed');
  await deal(sita, editionId, 5000, 'USD', 'confirmed');
  await deal(ooredoo, editionId, 999, 'USD', 'cancelled');
  await deal(ooredoo, otherEditionId, 7000, 'MVR', 'confirmed');
  await s.as.finance.post(`/api/deals/${d1}/payments`).send({ amount: 40000, paid_on: '2026-08-01', method: 'bank_transfer', invoice_no: 'INV-9' });

  await request(t.app).post('/api/public/enquiries').send({ name: 'Mariyam Ali', email: 'm@x.mv', message: 'Stand please' });
  await s.as.sales.post('/api/enquiries').send({ full_name: 'Hassan', phone: '1', source: 'phone', status: 'won' });
});

describe('post-event report', () => {
  it('is a PDF for the edition, for admin and events staff only', async () => {
    const res = await s.as.events.get(`/api/reports/post-event/${editionId}.pdf`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="CIF-2026-post-event-report.pdf"');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    // Document title (the PDF's info dictionary)
    expect(res.body.toString('latin1')).toContain('(CIF 2026 post-event report)');
    expect((await s.as.sales.get(`/api/reports/post-event/${editionId}.pdf`)).status).toBe(403);
    expect((await s.as.finance.get(`/api/reports/post-event/${editionId}.pdf`)).status).toBe(403);
    expect((await s.as.admin.get('/api/reports/post-event/00000000-0000-0000-0000-000000000000.pdf')).status).toBe(404);
  });

  it('logs the export', async () => {
    await s.as.events.get(`/api/reports/post-event/${editionId}.pdf`);
    const [log] = await t.db.query("select actor_id, action, entity, changes from activity_log where action = 'export'");
    expect(log).toEqual({ actor_id: s.ids.events, action: 'export', entity: 'reports', changes: { report: 'post-event', filters: { edition_id: editionId } } });
  });
});

describe('sponsorship report', () => {
  it('is a workbook of deals and payments with totals per currency', async () => {
    const res = await s.as.finance.get(`/api/reports/sponsorship.xlsx?edition_id=${editionId}`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="sponsorship-report.xlsx"');
    const wb = await workbook(res.body);
    const deals = wb.getWorksheet('Deals')!;
    expect(deals.views[0]).toEqual(expect.objectContaining({ state: 'frozen', ySplit: 1 }));
    expect(deals.autoFilter).toBeTruthy();
    expect(deals.getRow(1).values).toEqual([undefined, 'Sponsor', 'Event', 'Package', 'Status', 'Currency', 'Amount', 'Received', 'Outstanding']);
    const rows = deals.getSheetValues().slice(2).filter(Boolean) as unknown[][];
    const dealRows = rows.filter((r) => ['Proposed', 'Confirmed', 'Cancelled'].includes(r[4] as string));
    expect(dealRows).toHaveLength(4);
    const total = (cur: string) => rows.find((r) => r[1] === `Total ${cur}`)!;
    expect(total('MVR').slice(6, 9)).toEqual([150000, 40000, 110000]);
    expect(total('USD').slice(6, 9)).toEqual([5000, 0, 5000]);
    expect(typeof (dealRows[0][6] as number)).toBe('number');
    const payments = wb.getWorksheet('Payments')!;
    expect(payments.getRow(2).getCell(1).value).toEqual(new Date('2026-08-01T00:00:00Z'));
    expect(payments.getRow(2).getCell(6).value).toBe(40000);
  });

  it('can cover a date range instead of one edition', async () => {
    const res = await s.as.sales.get('/api/reports/sponsorship.xlsx?from=2025-01-01&to=2025-12-31').buffer(true).parse(binary);
    const rows = (await workbook(res.body)).getWorksheet('Deals')!.getSheetValues().slice(2).filter(Boolean) as unknown[][];
    expect(rows.filter((r) => r[2] === 'CIF 2025')).toHaveLength(1);
    expect(rows.filter((r) => r[2] === 'CIF 2026')).toHaveLength(0);
  });

  it('is also a PDF', async () => {
    const res = await s.as.admin.get(`/api/reports/sponsorship.pdf?edition_id=${editionId}`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('is never available to the events team', async () => {
    expect((await s.as.events.get('/api/reports/sponsorship.xlsx')).status).toBe(403);
    expect((await s.as.events.get('/api/reports/sponsorship.pdf')).status).toBe(403);
  });
});

describe('enquiries report', () => {
  it('lists the filtered enquiries with their latest note', async () => {
    const res = await s.as.sales.get('/api/reports/enquiries.xlsx?source=website').buffer(true).parse(binary);
    expect(res.status).toBe(200);
    const sheet = (await workbook(res.body)).getWorksheet('Enquiries')!;
    expect(sheet.getRow(1).getCell(2).value).toBe('Name');
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getRow(2).getCell(2).value).toBe('Mariyam Ali');
    expect((await s.as.sales.get('/api/reports/enquiries.xlsx').buffer(true).parse(binary)).status).toBe(200);
  });

  it('is only for admin and sales', async () => {
    expect((await s.as.finance.get('/api/reports/enquiries.xlsx')).status).toBe(403);
    expect((await s.as.events.get('/api/reports/enquiries.xlsx')).status).toBe(403);
  });
});
