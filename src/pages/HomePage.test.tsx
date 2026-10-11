import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../AppRoutes';
import { EVENT_SERIES } from '../data/websiteData';
import { seriesPath } from '../routes';

vi.mock('../lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return screen.getByRole('main');
}

describe('HomePage', () => {
  it('leads with the exact headline, intro and two calls to action', () => {
    const main = renderHome();
    expect(within(main).getByRole('heading', { level: 1 }).textContent).toBe(
      "Meet the Maldives' construction, marine and aviation leaders.",
    );
    expect(
      within(main).getByText(
        'MEDIUM Events organises the Construction Industry Forum, the Maldives Marine Industry Forum, the Aviation Forum and Build Expo, and delivers advertising, design and creative consultancy for brands across the Maldives.',
      ),
    ).toBeTruthy();
    expect(within(main).getAllByRole('link', { name: 'Become a sponsor' })[0].getAttribute('href')).toBe('/contact?service=sponsorship');
    expect(within(main).getByRole('link', { name: 'Explore events' }).getAttribute('href')).toBe('/events');
  });

  it('shows the real signing photo as the hero image, loaded first', () => {
    const main = renderHome();
    const hero = within(main).getAllByRole('img')[0];
    expect(hero.getAttribute('src')).toBe('/images/fb/ooredoo-cif-2026-signing.jpg');
    expect(hero.getAttribute('fetchpriority')).toBe('high');
  });

  it('links all four event series', () => {
    const main = renderHome();
    for (const series of EVENT_SERIES) {
      const links = within(main).getAllByRole('link').filter((a) => a.getAttribute('href') === seriesPath(series.slug));
      expect(links.length).toBeGreaterThan(0);
    }
  });

  it('shows the three most recent events, newest first', () => {
    const main = renderHome();
    const latest = within(main).getAllByRole('article').map((a) => within(a).getByRole('heading').textContent);
    expect(latest).toEqual(['Aviation Forum 2026', 'Construction Industry Forum 2025', 'Maldives Marine Industry Forum 2025']);
  });

  it('shows the services, verified stats and partners', () => {
    const main = renderHome();
    for (const title of ['Events', 'Advertising and marketing', 'Design and production', 'Creative consultancy']) {
      expect(within(main).getByRole('heading', { name: title })).toBeTruthy();
    }
    for (const value of ['9', '4', '2023', '60+']) expect(within(main).getByText(value)).toBeTruthy();
    for (const partner of ['MNACI', 'Ooredoo Maldives', 'SITA']) expect(within(main).getByText(partner)).toBeTruthy();
  });

  it('closes with the sponsor band', () => {
    const main = renderHome();
    expect(within(main).getByRole('heading', { name: 'Put your brand in front of the decision makers.' })).toBeTruthy();
    expect(within(main).getByText('Sponsorship and exhibition packages for every series.')).toBeTruthy();
  });

  it('does not claim every series runs every year', () => {
    const main = renderHome();
    expect(main.textContent).not.toMatch(/every year|annual series/i);
  });
});
