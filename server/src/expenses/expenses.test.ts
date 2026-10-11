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

async function expense(overrides: Record<string, unknown> = {}) {
  const res = await s.as.finance.post('/api/expenses').send({ edition_id: editionId, category: 'venue', description: 'Hall hire', amount: '45,000', currency: 'MVR', ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

// supertest: collect binary bodies as Buffers
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('expenses', () => {
  it('records an expense; only admin and finance can see or change money going out', async () => {
    const created = await s.as.finance.post('/api/expenses').send({ edition_id: editionId, category: 'venue', description: 'Hall hire', vendor: 'JEN Malé', amount: '45,000.50', currency: 'MVR' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({ description: 'Hall hire', vendor: 'JEN Malé', amount: 45000.5, currency: 'MVR', status: 'planned', paid_on: null, edition_name: 'CIF 2026', created_by_name: 'Test finance' }),
    );
    const { id } = created.body;
    for (const role of ['events', 'sales'] as const) {
      expect((await s.as[role].get('/api/expenses')).status).toBe(403);
      expect((await s.as[role].get(`/api/expenses/${id}`)).status).toBe(403);
      expect((await s.as[role].get('/api/expenses/summary')).status).toBe(403);
      expect((await s.as[role].post('/api/expenses').send({})).status).toBe(403);
      expect((await s.as[role].delete(`/api/expenses/${id}`)).status).toBe(403);
    }
    expect((await s.as.admin.get(`/api/expenses/${id}`)).body.amount).toBe(45000.5);
    expect((await s.as.admin.delete(`/api/expenses/${id}`)).status).toBe(204);
    expect((await s.as.admin.get(`/api/expenses/${id}`)).status).toBe(404);
  });

  it('checks amounts, categories and that a paid expense has its date', async () => {
    const bad = await s.as.admin.post('/api/expenses').send({ edition_id: editionId, category: 'bribes', description: '', amount: '-5', currency: 'EUR' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toEqual({
      category: 'Choose a category.',
      description: 'Enter what the money is for.',
      amount: 'Enter an amount like 1500 or 1500.50.',
      currency: 'Choose MVR or USD.',
    });
    const unpaidDate = await s.as.admin.post('/api/expenses').send({ edition_id: editionId, category: 'venue', description: 'Hall', amount: 1, currency: 'MVR', status: 'paid' });
    expect(unpaidDate.body.fields).toEqual({ paid_on: 'Enter the date it was paid.' });

    const { id } = await expense();
    expect((await s.as.finance.patch(`/api/expenses/${id}`).send({ status: 'paid' })).body.fields).toEqual({ paid_on: 'Enter the date it was paid.' });
    const paid = await s.as.finance.patch(`/api/expenses/${id}`).send({ status: 'paid', paid_on: '2026-10-10', invoice_no: 'JEN-88' });
    expect(paid.body).toEqual(expect.objectContaining({ status: 'paid', paid_on: '2026-10-10', invoice_no: 'JEN-88' }));
    expect((await s.as.finance.patch(`/api/expenses/${id}`).send({ paid_on: null })).status).toBe(400);
    const log = await t.db.query("select action, changes from activity_log where entity = 'expenses' order by id");
    expect(log).toEqual([
      { action: 'create', changes: { description: 'Hall hire', amount: 45000, currency: 'MVR', status: 'planned' } },
      { action: 'update', changes: { status: { old: 'planned', new: 'paid' }, paid_on: { old: null, new: '2026-10-10' }, invoice_no: { old: '', new: 'JEN-88' } } },
    ]);
  });

  it('filters by edition, status and category', async () => {
    await expense({ description: 'Hall hire', status: 'committed' });
    await expense({ description: 'Lunch', category: 'catering' });
    await expense({ description: 'Next year deposit', edition_id: otherEditionId });
    const list = async (query: string) => (await s.as.finance.get(`/api/expenses?${query}`)).body.map((x: { description: string }) => x.description).sort();
    expect(await list(`edition_id=${editionId}`)).toEqual(['Hall hire', 'Lunch']);
    expect(await list(`edition_id=${editionId}&status=committed`)).toEqual(['Hall hire']);
    expect(await list('category=catering')).toEqual(['Lunch']);
    expect(await list('')).toHaveLength(3);
  });

  it('sets sponsorship income against expenses, per currency', async () => {
    const sponsor = (await s.as.sales.post('/api/sponsors').send({ company: 'Ooredoo' })).body;
    const deal = async (amount: number, currency: string, status: string, edition = editionId) =>
      (await s.as.sales.post('/api/deals').send({ sponsor_id: sponsor.id, edition_id: edition, package: 'P', amount, currency, status })).body.id as string;
    const confirmed = await deal(100000, 'MVR', 'confirmed');
    const proposed = await deal(30000, 'MVR', 'proposed');
    await deal(999, 'MVR', 'cancelled');
    await deal(5000, 'USD', 'confirmed', otherEditionId);
    await s.as.finance.post(`/api/deals/${confirmed}/payments`).send({ amount: 40000, paid_on: '2026-10-01', method: 'bank_transfer' });
    await s.as.finance.post(`/api/deals/${proposed}/payments`).send({ amount: 5000, paid_on: '2026-10-02', method: 'cash' });

    await expense({ amount: 45000, status: 'paid', paid_on: '2026-10-05' });
    await expense({ description: 'Lunch', category: 'catering', amount: 20000.1, status: 'committed' });
    await expense({ description: 'Badges', category: 'printing', amount: 5000.2 });
    await expense({ description: 'Speaker flight', category: 'travel', amount: 800, currency: 'USD' });

    const one = await s.as.finance.get(`/api/expenses/summary?edition_id=${editionId}`);
    expect(one.status).toBe(200);
    expect(one.body).toEqual([
      {
        currency: 'MVR',
        income_confirmed: 100000,
        income_received: 45000,
        expenses_planned: 5000.2,
        expenses_committed: 20000.1,
        expenses_paid: 45000,
        expenses_total: 70000.3,
        projected_result: 29999.7,
        cash_result: 0,
      },
      // Costs in a currency with no income still show
      { currency: 'USD', income_confirmed: 0, income_received: 0, expenses_planned: 800, expenses_committed: 0, expenses_paid: 0, expenses_total: 800, projected_result: -800, cash_result: 0 },
    ]);
    const all = (await s.as.admin.get('/api/expenses/summary')).body;
    expect(all.find((x: { currency: string }) => x.currency === 'USD')).toEqual(expect.objectContaining({ income_confirmed: 5000, projected_result: 4200 }));
    expect((await s.as.admin.get(`/api/expenses/summary?edition_id=${otherEditionId}`)).body).toEqual([expect.objectContaining({ currency: 'USD', expenses_total: 0, projected_result: 5000 })]);
  });

  it('keeps an edition that has expenses, and exports the budget to Excel', async () => {
    await expense({ vendor: 'JEN Malé', status: 'paid', paid_on: '2026-10-05' });
    const refused = await s.as.admin.delete(`/api/editions/${editionId}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe('This edition has expenses recorded. Cancel it instead, or remove them first.');

    const res = await s.as.finance.get(`/api/reports/budget.xlsx?edition_id=${editionId}`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="budget-report.xlsx"');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    const row = (sheet: string, n: number) => (wb.getWorksheet(sheet)!.getRow(n).values as unknown[]).slice(1);
    expect(row('Summary', 2)).toEqual(['MVR', 0, 0, 0, 0, 45000, 45000, -45000, -45000]);
    expect(row('Expenses', 2).slice(0, 7)).toEqual(['CIF 2026', 'Venue', 'Hall hire', 'JEN Malé', 'Paid', 'MVR', 45000]);
    expect((row('Expenses', 2)[7] as Date).toISOString()).toBe('2026-10-05T00:00:00.000Z');
    for (const role of ['events', 'sales'] as const) expect((await s.as[role].get('/api/reports/budget.xlsx')).status).toBe(403);
  });
});
