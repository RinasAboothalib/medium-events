import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { parseOrigins, publicCors } from './cors.js';

const app = (origins: string | undefined) => express().use(publicCors(origins)).post('/', (_req, res) => res.json({ ok: true }));

describe('public CORS', () => {
  it('reads one address or a comma-separated list, ignoring spaces and trailing slashes', () => {
    expect(parseOrigins('https://medium.mv')).toEqual(['https://medium.mv']);
    expect(parseOrigins(' https://medium.mv/, https://www.medium.mv ,')).toEqual(['https://medium.mv', 'https://www.medium.mv']);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('allows each listed website and no other', async () => {
    const site = app('https://medium.mv, https://www.medium.mv');
    for (const origin of ['https://medium.mv', 'https://www.medium.mv']) {
      const res = await request(site).options('/').set('Origin', origin);
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
    expect((await request(site).post('/').set('Origin', 'https://other.example')).headers['access-control-allow-origin']).toBeUndefined();
    expect((await request(app(undefined)).post('/').set('Origin', 'https://medium.mv')).headers['access-control-allow-origin']).toBeUndefined();
  });
});
