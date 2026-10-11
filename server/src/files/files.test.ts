import { beforeEach, describe, expect, it } from 'vitest';
import { JPEG, setup, signedInAsEveryRole } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof signedInAsEveryRole>>;

beforeEach(async () => {
  t = await setup();
  s = await signedInAsEveryRole(t);
});

const upload = (role: keyof typeof s.as, body: Buffer = JPEG, type = 'image/jpeg', filename = 'banner.jpg') =>
  s.as[role].post(`/api/files?filename=${filename}`).set('Content-Type', type).send(body);

describe('files', () => {
  it('stores an uploaded image and serves it back', async () => {
    const res = await upload('events');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), filename: 'banner.jpg', content_type: 'image/jpeg', size: JPEG.length });
    const got = await s.as.sales.get(`/api/files/${res.body.id}`).buffer(true);
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(got.body, JPEG)).toBe(0);
    const log = await t.db.query("select action from activity_log where entity = 'files'");
    expect(log).toEqual([{ action: 'create' }]);
  });

  it('only lets admins and events staff upload', async () => {
    expect((await upload('admin')).status).toBe(201);
    expect((await upload('sales')).status).toBe(403);
    expect((await upload('finance')).status).toBe(403);
  });

  it('refuses files that are not JPG, PNG or WebP', async () => {
    const res = await upload('admin', Buffer.from('hello'), 'text/plain', 'notes.txt');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Upload a JPG, PNG or WebP image.');
  });

  it('refuses images over 5 MB', async () => {
    const res = await upload('admin', Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png', 'big.png');
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Images must be 5 MB or smaller.');
  });

  it('returns 404 for an unknown file', async () => {
    expect((await s.as.admin.get('/api/files/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await s.as.admin.get('/api/files/not-a-uuid')).status).toBe(404);
  });
});
