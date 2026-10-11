import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, setup, signedInAsEveryRole } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;

beforeEach(async () => {
  t = await setup({ config: { publicSiteOrigin: 'https://medium.mv' } });
  s = await signedInAsEveryRole(t);
});

const websiteForm = {
  name: 'Mariyam Ali',
  company: 'Island Builders',
  email: 'mariyam@islandbuilders.mv',
  phone: '+960 777 1234',
  service: 'Sponsorship or exhibition stand',
  event: 'Construction Industry Forum 2026',
  timeline: 'Within 3 months',
  budget: 'USD 5,000',
  message: 'We would like a stand at CIF.',
  botcheck: '',
};

const manual = { full_name: 'Hassan Rasheed', phone: '+960 999 0000', source: 'phone', message: 'Called about Build Expo.' };

async function createManual(overrides: Record<string, unknown> = {}) {
  const res = await s.as.sales.post('/api/enquiries').send({ ...manual, ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

describe('website enquiries', () => {
  it('stores an enquiry from the website form without signing in', async () => {
    const res = await request(t.app).post('/api/public/enquiries').set('Origin', 'https://medium.mv').send(websiteForm);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['access-control-allow-origin']).toBe('https://medium.mv');
    const list = await s.as.sales.get('/api/enquiries');
    expect(list.body.total).toBe(1);
    expect(list.body.rows[0]).toEqual(
      expect.objectContaining({
        full_name: 'Mariyam Ali',
        company: 'Island Builders',
        email: 'mariyam@islandbuilders.mv',
        source: 'website',
        status: 'new',
        budget: 'USD 5,000',
        event: 'Construction Industry Forum 2026',
        assignee_id: null,
      }),
    );
    const log = await t.db.query("select actor_id, action from activity_log where entity = 'enquiries'");
    expect(log).toEqual([{ actor_id: null, action: 'create' }]);
  });

  it('quietly drops enquiries that fill the hidden honeypot', async () => {
    const res = await request(t.app).post('/api/public/enquiries').send({ ...websiteForm, botcheck: 'on' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect((await s.as.sales.get('/api/enquiries')).body.total).toBe(0);
  });

  it('limits each connection to 10 enquiries an hour', async () => {
    for (let i = 0; i < 10; i++) expect((await request(t.app).post('/api/public/enquiries').send(websiteForm)).status).toBe(201);
    const blocked = await request(t.app).post('/api/public/enquiries').send(websiteForm);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('Too many enquiries from this connection. Try again later.');
    t.advance(60 * 60 * 1000 + 1);
    expect((await request(t.app).post('/api/public/enquiries').send(websiteForm)).status).toBe(201);
  });

  it('needs a name and a way to reply', async () => {
    const res = await request(t.app).post('/api/public/enquiries').send({ ...websiteForm, name: ' ', email: '', phone: '' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ name: 'Enter your name.', email: 'Enter an email address or phone number.' });
    const bad = await request(t.app).post('/api/public/enquiries').send({ ...websiteForm, email: 'not-an-email' });
    expect(bad.body.fields.email).toBe('Enter a valid email address.');
  });
});

describe('enquiries in the admin', () => {
  it('is only for admins and sales', async () => {
    expect((await s.as.admin.get('/api/enquiries')).status).toBe(200);
    expect((await s.as.events.get('/api/enquiries')).status).toBe(403);
    expect((await s.as.finance.post('/api/enquiries').send(manual)).status).toBe(403);
  });

  it('records a phone enquiry and opens it with its notes', async () => {
    const { id } = await createManual();
    await s.as.sales.post(`/api/enquiries/${id}/notes`).send({ body: 'Sent the stand price list.' });
    const res = await s.as.admin.get(`/api/enquiries/${id}`);
    expect(res.body).toEqual(expect.objectContaining({ full_name: 'Hassan Rasheed', source: 'phone', latest_note: 'Sent the stand price list.' }));
    expect(res.body.notes).toEqual([{ id: expect.any(String), author_name: 'Test sales', body: 'Sent the stand price list.', created_at: expect.any(String) }]);
  });

  it('changes status and assignee, logging the change', async () => {
    const { id } = await createManual();
    const res = await s.as.sales.patch(`/api/enquiries/${id}`).send({ status: 'contacted', assignee_id: s.ids.sales });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'contacted', assignee_id: s.ids.sales, assignee_name: 'Test sales' }));
    const [log] = await t.db.query("select changes from activity_log where entity = 'enquiries' and action = 'update'");
    expect(log.changes).toEqual({ status: { old: 'new', new: 'contacted' }, assignee_id: { old: null, new: s.ids.sales } });
  });

  it('only assigns enquiries to people who handle them (admin and sales)', async () => {
    const { id } = await createManual();
    const res = await s.as.sales.patch(`/api/enquiries/${id}`).send({ assignee_id: s.ids.events });
    expect(res.status).toBe(400);
    expect(res.body.fields.assignee_id).toBe('Choose an active admin or member of the sales team.');
    expect((await s.as.sales.patch(`/api/enquiries/${id}`).send({ assignee_id: s.ids.admin })).status).toBe(200);
  });

  it('only assigns enquiries to active staff', async () => {
    const { id } = await createManual();
    const other = await createUser(t.db, { role: 'sales', email: 'gone@medium.mv', active: false });
    const res = await s.as.sales.patch(`/api/enquiries/${id}`).send({ assignee_id: other.id });
    expect(res.status).toBe(400);
    expect(res.body.fields.assignee_id).toBe('Choose an active admin or member of the sales team.');
  });

  it('filters by status, source, assignee, search text and Maldives dates', async () => {
    const a = await createManual({ full_name: 'Aminath Hussain', company: 'Ocean Marine' });
    await t.db.query("update enquiries set created_at = created_at - interval '1 day' where id = $1", [a.id]);
    await createManual({ full_name: 'Ibrahim Naseem', source: 'email', email: 'ibrahim@example.mv' });
    await s.as.sales.patch(`/api/enquiries/${a.id}`).send({ status: 'won', assignee_id: s.ids.admin });
    const names = async (query: string) => (await s.as.sales.get(`/api/enquiries?${query}`)).body.rows.map((r: { full_name: string }) => r.full_name);
    expect(await names('')).toEqual(['Ibrahim Naseem', 'Aminath Hussain']);
    expect(await names('status=won')).toEqual(['Aminath Hussain']);
    expect(await names('source=email')).toEqual(['Ibrahim Naseem']);
    expect(await names(`assignee=${s.ids.admin}`)).toEqual(['Aminath Hussain']);
    expect(await names('q=ocean')).toEqual(['Aminath Hussain']);
    expect(await names('q=IBRAHIM@')).toEqual(['Ibrahim Naseem']);
    // The clock is 2026-10-13 09:00 Maldives time; Aminath's enquiry is a day older
    expect(await names('from=2026-10-13&to=2026-10-13')).toEqual(['Ibrahim Naseem']);
    expect(await names('to=2026-10-12')).toEqual(['Aminath Hussain']);
  });

  it('pages 50 at a time', async () => {
    for (let i = 0; i < 51; i++) await t.db.query("insert into enquiries (full_name, phone, source) values ($1, '1', 'other')", [`Person ${i}`]);
    const first = await s.as.admin.get('/api/enquiries');
    expect(first.body.rows).toHaveLength(50);
    expect(first.body.total).toBe(51);
    expect((await s.as.admin.get('/api/enquiries?page=1')).body.rows).toHaveLength(1);
  });

  it('checks the fields', async () => {
    const res = await s.as.sales.post('/api/enquiries').send({ full_name: 'X', source: 'carrier pigeon' });
    expect(res.status).toBe(400);
    expect(res.body.fields.source).toBe('Choose where the enquiry came from.');
    const { id } = await createManual();
    expect((await s.as.sales.patch(`/api/enquiries/${id}`).send({ status: 'maybe' })).body.fields.status).toBe('Choose a status.');
    expect((await s.as.sales.post(`/api/enquiries/${id}/notes`).send({ body: '  ' })).body.fields.body).toBe('Write a note.');
  });
});
