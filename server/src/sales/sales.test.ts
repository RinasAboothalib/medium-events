import { beforeEach, describe, expect, it } from 'vitest';
import { ROLE_LIST, setup, signedInAsEveryRole } from '../test/helpers.js';
import { parseMoney } from './money.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;
let editionId: string;

beforeEach(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
  const series = (await s.as.admin.post('/api/series').send({ slug: 'cif', name: 'CIF', label: 'CIF', short_name: 'CIF' })).body;
  editionId = (await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2026', start_date: '2026-09-01' })).body.id;
});

async function sponsor(company = 'Ooredoo Maldives') {
  const res = await s.as.sales.post('/api/sponsors').send({ company, contact_name: 'Ahmed', email: 'ahmed@ooredoo.mv' });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

async function deal(overrides: Record<string, unknown> = {}) {
  const sp = overrides.sponsor_id ? null : await sponsor(`Sponsor ${Math.random()}`);
  const res = await s.as.sales.post('/api/deals').send({ sponsor_id: sp?.id, edition_id: editionId, package: 'Platinum', amount: '150,000', currency: 'MVR', status: 'confirmed', ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string; sponsor_id: string };
}

// Any key that carries money, anywhere in a JSON value
function moneyKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => moneyKeys(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [...(['amount', 'paid', 'outstanding', 'currency', 'totals'].includes(k) ? [`${path}.${k}`] : []), ...moneyKeys(v, `${path}.${k}`)]);
  }
  return [];
}

describe('parseMoney', () => {
  it('accepts amounts with commas and up to two decimals', () => {
    expect(parseMoney('1,500.50')).toBe(1500.5);
    expect(parseMoney(2000)).toBe(2000);
    expect(parseMoney(' 75 ')).toBe(75);
  });
  it('refuses anything else', () => {
    for (const bad of ['abc', '1.234', '-5', '0', '', '1e5', 10_000_000_000]) expect(parseMoney(bad)).toBeNull();
  });
});

describe('sponsors', () => {
  it('lets everyone read and only admin and sales write', async () => {
    const { id } = await sponsor();
    for (const role of ROLE_LIST) expect((await s.as[role].get('/api/sponsors')).status).toBe(200);
    expect((await s.as.events.post('/api/sponsors').send({ company: 'X' })).status).toBe(403);
    expect((await s.as.finance.patch(`/api/sponsors/${id}`).send({ phone: '1' })).status).toBe(403);
    expect((await s.as.admin.patch(`/api/sponsors/${id}`).send({ phone: '+960 333 0000' })).body.phone).toBe('+960 333 0000');
  });

  it('refuses a second sponsor with the same company name', async () => {
    await sponsor('Ooredoo Maldives');
    const res = await s.as.sales.post('/api/sponsors').send({ company: '  ooredoo maldives ' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('That sponsor already exists.');
  });

  it('shows a sponsor with its deals and deal count', async () => {
    const sp = await sponsor();
    await deal({ sponsor_id: sp.id });
    const res = await s.as.finance.get(`/api/sponsors/${sp.id}`);
    expect(res.body).toEqual(expect.objectContaining({ company: 'Ooredoo Maldives', deal_count: 1 }));
    expect(res.body.deals).toEqual([expect.objectContaining({ package: 'Platinum', amount: 150000, currency: 'MVR', paid: 0, outstanding: 150000 })]);
  });
});

describe('deals', () => {
  it('creates a deal, logging it', async () => {
    const d = await deal();
    expect(d).toEqual(expect.objectContaining({ edition_name: 'CIF 2026', package: 'Platinum', amount: 150000, currency: 'MVR', status: 'confirmed', paid: 0, outstanding: 150000 }));
    const log = await t.db.query("select action from activity_log where entity = 'deals'");
    expect(log).toEqual([{ action: 'create' }]);
  });

  it('checks amounts and currencies', async () => {
    const sp = await sponsor();
    const bad = await s.as.sales.post('/api/deals').send({ sponsor_id: sp.id, edition_id: editionId, package: 'Gold', amount: 'abc', currency: 'EUR' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toEqual(expect.objectContaining({ amount: 'Enter an amount like 1500 or 1500.50.', currency: 'Choose MVR or USD.' }));
  });

  it('totals by currency, leaving out cancelled deals', async () => {
    await deal({ amount: 100000, currency: 'MVR' });
    await deal({ amount: 50000, currency: 'MVR', status: 'proposed' });
    await deal({ amount: 5000, currency: 'USD' });
    await deal({ amount: 999, currency: 'USD', status: 'cancelled' });
    const res = await s.as.finance.get(`/api/deals?edition_id=${editionId}`);
    expect(res.body.rows).toHaveLength(4);
    expect(res.body.totals).toEqual([
      { currency: 'MVR', amount: 150000, paid: 0, outstanding: 150000 },
      { currency: 'USD', amount: 5000, paid: 0, outstanding: 5000 },
    ]);
  });

  it('filters by sponsor and status', async () => {
    const a = await deal({ status: 'proposed' });
    await deal();
    expect((await s.as.sales.get(`/api/deals?sponsor_id=${a.sponsor_id}`)).body.rows).toHaveLength(1);
    expect((await s.as.sales.get('/api/deals?status=proposed')).body.rows.map((r: { id: string }) => r.id)).toEqual([a.id]);
  });

  it('never shows money to the events team', async () => {
    const d = await deal();
    await s.as.finance.post(`/api/deals/${d.id}/payments`).send({ amount: 1000, paid_on: '2026-10-01', method: 'bank_transfer' });
    const responses = [
      await s.as.events.get('/api/deals'),
      await s.as.events.get(`/api/deals/${d.id}`),
      await s.as.events.get('/api/sponsors'),
      await s.as.events.get(`/api/sponsors/${d.sponsor_id}`),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(moneyKeys(res.body)).toEqual([]);
    }
    expect(responses[0].body.rows[0]).toEqual(expect.objectContaining({ package: 'Platinum', status: 'confirmed' }));
    expect(responses[0].body.rows[0]).not.toHaveProperty('notes');
    expect((await s.as.events.get(`/api/deals/${d.id}/payments`)).status).toBe(403);
  });

  it('only lets admin and sales change deals', async () => {
    const d = await deal();
    expect((await s.as.finance.patch(`/api/deals/${d.id}`).send({ status: 'cancelled' })).status).toBe(403);
    expect((await s.as.events.post('/api/deals').send({})).status).toBe(403);
    const res = await s.as.sales.patch(`/api/deals/${d.id}`).send({ amount: '160000.00' });
    expect(res.body.amount).toBe(160000);
    const [log] = await t.db.query("select changes from activity_log where entity = 'deals' and action = 'update'");
    expect(log.changes).toEqual({ amount: { old: 150000, new: 160000 } });
  });
});

describe('editions with deals', () => {
  it('cannot be deleted while they have deals', async () => {
    await deal();
    const res = await s.as.admin.delete(`/api/editions/${editionId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This edition has sponsorship deals. Cancel it instead, or move its deals first.');
    expect((await s.as.admin.get(`/api/editions/${editionId}`)).status).toBe(200);
  });
});

describe('payments', () => {
  it('records payments and updates what is outstanding', async () => {
    const d = await deal({ amount: 1000, currency: 'USD' });
    const p = await s.as.finance.post(`/api/deals/${d.id}/payments`).send({ amount: '400', paid_on: '2026-10-01', method: 'bank_transfer', invoice_no: 'INV-001' });
    expect(p.status).toBe(201);
    expect(p.body).toEqual(expect.objectContaining({ amount: 400, paid_on: '2026-10-01', method: 'bank_transfer', invoice_no: 'INV-001', recorded_by_name: 'Test finance' }));
    expect((await s.as.sales.get(`/api/deals/${d.id}`)).body).toEqual(expect.objectContaining({ paid: 400, outstanding: 600 }));
    expect((await s.as.sales.get(`/api/deals/${d.id}/payments`)).body).toHaveLength(1);
  });

  it('shows overpayment as negative outstanding', async () => {
    const d = await deal({ amount: 1000, currency: 'USD' });
    await s.as.admin.post(`/api/deals/${d.id}/payments`).send({ amount: 1050, paid_on: '2026-10-01', method: 'cash' });
    expect((await s.as.finance.get(`/api/deals/${d.id}`)).body.outstanding).toBe(-50);
  });

  it('refuses payments on a cancelled deal', async () => {
    const d = await deal({ status: 'cancelled' });
    const res = await s.as.finance.post(`/api/deals/${d.id}/payments`).send({ amount: 10, paid_on: '2026-10-01', method: 'cash' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This deal is cancelled.');
  });

  it('lets only admin and finance record, and only admin delete', async () => {
    const d = await deal();
    expect((await s.as.sales.post(`/api/deals/${d.id}/payments`).send({ amount: 10, paid_on: '2026-10-01', method: 'cash' })).status).toBe(403);
    const p = await s.as.finance.post(`/api/deals/${d.id}/payments`).send({ amount: 10, paid_on: '2026-10-01', method: 'cash' });
    expect((await s.as.finance.delete(`/api/payments/${p.body.id}`)).status).toBe(403);
    expect((await s.as.admin.delete(`/api/payments/${p.body.id}`)).status).toBe(204);
    const log = await t.db.query("select action from activity_log where entity = 'payments' order by id");
    expect(log).toEqual([{ action: 'create' }, { action: 'delete' }]);
  });

  it('checks the payment fields', async () => {
    const d = await deal();
    const res = await s.as.finance.post(`/api/deals/${d.id}/payments`).send({ amount: '0', paid_on: 'yesterday', method: 'barter' });
    expect(res.body.fields).toEqual({ amount: 'Enter an amount like 1500 or 1500.50.', paid_on: 'Use a date like 2026-10-31.', method: 'Choose how it was paid.' });
  });
});
