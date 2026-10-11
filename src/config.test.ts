import { describe, expect, it } from 'vitest';
import { normalizeAdminUrl, normalizeSiteUrl } from './config';

describe('normalizeSiteUrl', () => {
  it('defaults to https://medium.mv when unset', () => {
    expect(normalizeSiteUrl(undefined)).toBe('https://medium.mv');
    expect(normalizeSiteUrl('')).toBe('https://medium.mv');
  });

  it('strips trailing slashes', () => {
    expect(normalizeSiteUrl('https://medium.mv/')).toBe('https://medium.mv');
    expect(normalizeSiteUrl('https://staging.example.com//')).toBe('https://staging.example.com');
  });
});

describe('normalizeAdminUrl', () => {
  it('defaults to the local admin app', () => {
    expect(normalizeAdminUrl(undefined)).toBe('http://localhost:3010');
    expect(normalizeAdminUrl('  ')).toBe('http://localhost:3010');
  });

  it('strips trailing slashes from a deployed address', () => {
    expect(normalizeAdminUrl('https://admin.medium.mv/')).toBe('https://admin.medium.mv');
  });
});
