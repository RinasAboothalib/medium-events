import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setup } from './test/helpers.js';

let dist: string;

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'admin-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>MEDIUM Admin</title>');
  writeFileSync(join(dist, 'assets', 'app.js'), 'console.log(1)');
});

afterEach(() => rmSync(dist, { recursive: true, force: true }));

describe('serving the admin app', () => {
  it('serves its files and sends every other page to index.html', async () => {
    const t = await setup({ adminDist: dist });
    const asset = await request(t.app).get('/assets/app.js');
    expect(asset.status).toBe(200);
    expect(asset.text).toBe('console.log(1)');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    for (const path of ['/', '/events/123', '/login']) {
      const page = await request(t.app).get(path);
      expect(page.status).toBe(200);
      expect(page.text).toContain('<title>MEDIUM Admin</title>');
      expect(page.headers['cache-control']).toBe('no-cache');
    }
  });

  it('keeps API errors as JSON', async () => {
    const t = await setup({ adminDist: dist });
    const res = await request(t.app).get('/api/nope');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Sign in to continue.' });
  });

  it('serves nothing else when no admin build is configured', async () => {
    const t = await setup();
    expect((await request(t.app).get('/events')).status).toBe(404);
  });
});
