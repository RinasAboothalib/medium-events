import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const UNREACHABLE = "Can't reach the MEDIUM server. Check it's running and try again.";

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('explains when the server is not running (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 0, message: UNREACHABLE });
  });

  it('explains when the dev proxy cannot reach the server (5xx without a server error body)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 0, message: UNREACHABLE });
  });

  it("passes on the server's own error message", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Email or password is incorrect.' }, { status: 401 })));
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 401, message: 'Email or password is incorrect.' });
  });
});
