import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { setup, signedInAsEveryRole } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;

// The clock is 2026-10-13 09:00 Maldives time
beforeEach(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
  const series = (await s.as.admin.post('/api/series').send({ slug: 'cif', name: 'CIF', label: 'CIF', short_name: 'CIF' })).body;
  const edition = (await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2026', start_date: '2026-11-01', status: 'upcoming' })).body;
  await s.as.admin.post('/api/editions').send({ series_id: series.id, name: 'CIF 2025', start_date: '2025-09-01', status: 'past' });
  const sponsor = (await s.as.sales.post('/api/sponsors').send({ company: 'Ooredoo' })).body;
  const deal = (await s.as.sales.post('/api/deals').send({ sponsor_id: sponsor.id, edition_id: edition.id, package: 'P', amount: 1000, currency: 'USD', status: 'confirmed' })).body;
  await s.as.sales.post('/api/deals').send({ sponsor_id: sponsor.id, edition_id: edition.id, package: 'Q', amount: 20000, currency: 'MVR', status: 'proposed' });
  await s.as.finance.post(`/api/deals/${deal.id}/payments`).send({ amount: 250, paid_on: '2026-10-02', method: 'cash' });
  await s.as.finance.post(`/api/deals/${deal.id}/payments`).send({ amount: 100, paid_on: '2026-09-30', method: 'cash' });
  await s.as.events.post('/api/tasks').send({ edition_id: edition.id, title: 'Book the hall', due_date: '2026-10-12' });
  await s.as.events.post('/api/tasks').send({ edition_id: edition.id, title: 'Print badges', due_date: '2026-10-30' });
  await s.as.events.post('/api/tasks').send({ edition_id: edition.id, title: 'Send invitations', due_date: '2026-10-01', status: 'done' });
  await request(t.app).post('/api/public/enquiries').send({ name: 'A', phone: '1' });
  const old = await s.as.sales.post('/api/enquiries').send({ full_name: 'B', phone: '1', source: 'phone' });
  await t.db.query("update enquiries set created_at = created_at - interval '10 days' where id = $1", [old.body.id]);
  await s.as.sales.post('/api/enquiries').send({ full_name: 'C', phone: '1', source: 'phone', status: 'lost' });
});

const cards = async (role: keyof typeof s.as) => {
  const res = await s.as[role].get('/api/dashboard');
  expect(res.status).toBe(200);
  return Object.fromEntries((res.body.cards as { id: string; label: string; value: string }[]).map((c) => [c.id, c.value]));
};

describe('dashboard', () => {
  it('gives sales their pipeline', async () => {
    expect(await cards('sales')).toEqual({ new_enquiries: '2', open_enquiries: '2', confirmed_deals_month: '1' });
  });

  it('gives finance money by currency', async () => {
    expect(await cards('finance')).toEqual({ outstanding_MVR: 'MVR 20,000.00', outstanding_USD: 'USD 650.00', payments_month: 'USD 250.00' });
  });

  it('gives the events team events without money', async () => {
    await s.as.events.post('/api/publish');
    const events = await cards('events');
    expect(events).toEqual({ upcoming_editions: '1', open_tasks: '2 (1 overdue)', last_publish: '13 Oct 2026, 09:00' });
    expect(JSON.stringify(events)).not.toMatch(/MVR|USD/);
  });

  it('gives admins everything', async () => {
    expect(Object.keys(await cards('admin'))).toEqual([
      'new_enquiries',
      'open_enquiries',
      'confirmed_deals_month',
      'outstanding_MVR',
      'outstanding_USD',
      'payments_month',
      'upcoming_editions',
      'open_tasks',
      'last_publish',
    ]);
    expect((await cards('admin')).last_publish).toBe('Never');
  });
});
