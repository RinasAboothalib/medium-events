import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from './AppRoutes';
import { ROUTES } from './routes';

vi.mock('./lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

// Claims removed because they couldn't be verified (see docs/content-to-confirm.md).
// Re-adding any of them needs confirmation from MEDIUM first.
const UNVERIFIED = [
  'HOSCO',
  'Marine Expo',
  '12,000',
  'Visiting Guide',
  'Maldives Publications',
  '100+ turnkey',
  'Ministry of Transport',
  'Civil Aviation Authority',
  'Regional Airlines Alliance',
  'Indian Ocean Divers',
  'NBAM',
];

const HYPE = ['nation-scale', 'executive overview', 'mandate', 'indelible', 'paramount', 'curate', 'bespoke'];

describe('content guard', () => {
  it.each(ROUTES.map((r) => r.path))('%s shows no unverified claims or hype words', (path) => {
    const { container, unmount } = render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    const text = container.textContent!.toLowerCase();
    for (const phrase of [...UNVERIFIED, ...HYPE]) expect(text).not.toContain(phrase.toLowerCase());
    unmount();
  });

  it('keeps unverified claims out of the site data', () => {
    const source = readFileSync(resolve(__dirname, 'data/websiteData.ts'), 'utf8').toLowerCase();
    for (const phrase of UNVERIFIED) expect(source).not.toContain(phrase.toLowerCase());
  });
});
