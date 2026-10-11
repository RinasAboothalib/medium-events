import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSiteData } from './fetch-site-data.mjs';

const API = 'https://admin.medium.mv';
const snapshot = {
  published_at: '2026-10-13T05:00:00.000Z',
  series: [{ slug: 'cif', name: 'CIF', series: 'Construction Industry Forum', partners: [] }],
  events: [
    { id: 'e1', name: 'CIF 2026', image: '/api/public/files/11111111-1111-1111-1111-111111111111' },
    { id: 'e2', name: 'CIF 2025', image: '' },
  ],
  upcoming: [],
  partners: [],
};

let dir;
let outFile;
let imageDir;

const response = (status, body, type = 'application/json') =>
  new Response(typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body), { status, headers: { 'Content-Type': type } });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'site-data-'));
  outFile = join(dir, 'published.json');
  imageDir = join(dir, 'cms');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('fetchSiteData', () => {
  it('skips and removes stale data when no admin API is configured', async () => {
    writeFileSync(outFile, '{}');
    expect(await fetchSiteData({ apiUrl: '', outFile, imageDir, fetch: vi.fn() })).toBe('skipped');
    expect(existsSync(outFile)).toBe(false);
  });

  it('downloads the snapshot and its images, pointing images at local copies', async () => {
    const fetch = vi.fn(async (url) =>
      url.endsWith('/api/public/site-data') ? response(200, snapshot) : response(200, new Uint8Array([1, 2, 3]), 'image/jpeg'),
    );
    expect(await fetchSiteData({ apiUrl: `${API}/`, outFile, imageDir, fetch })).toBe('written');
    expect(fetch).toHaveBeenCalledWith(`${API}/api/public/site-data`);
    expect(fetch).toHaveBeenCalledWith(`${API}/api/public/files/11111111-1111-1111-1111-111111111111`);
    const written = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(written.events[0].image).toBe('/images/cms/11111111-1111-1111-1111-111111111111.jpg');
    expect(written.events[1].image).toBe('');
    expect([...readFileSync(join(imageDir, '11111111-1111-1111-1111-111111111111.jpg'))]).toEqual([1, 2, 3]);
  });

  it('uses built-in data when nothing has been published', async () => {
    writeFileSync(outFile, '{"old":true}');
    const fetch = vi.fn(async () => response(404, { error: 'Nothing published yet.' }));
    expect(await fetchSiteData({ apiUrl: API, outFile, imageDir, fetch })).toBe('skipped');
    expect(existsSync(outFile)).toBe(false);
  });

  it('keeps the previous data and warns when the server cannot be reached', async () => {
    writeFileSync(outFile, '{"old":true}');
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await fetchSiteData({ apiUrl: API, outFile, imageDir, fetch })).toBe('failed');
    expect(readFileSync(outFile, 'utf8')).toBe('{"old":true}');
    expect(console.warn).toHaveBeenCalled();
  });

  it('fails without writing anything when an image download fails', async () => {
    const fetch = vi.fn(async (url) => (url.endsWith('site-data') ? response(200, snapshot) : response(500, 'oops', 'text/plain')));
    expect(await fetchSiteData({ apiUrl: API, outFile, imageDir, fetch })).toBe('failed');
    expect(existsSync(outFile)).toBe(false);
  });
});
