import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../AppRoutes';
import { EVENT_SERIES } from '../data/websiteData';
import { seriesPath } from '../routes';

vi.mock('../lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const MAIN_NAV = [
  ['Home', '/'],
  ['Events', '/events'],
  ['Services', '/services'],
  ['About', '/about'],
  ['News', '/news'],
  ['Contact', '/contact'],
];

describe('header', () => {
  it('links the six main pages', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual(MAIN_NAV);
  });

  it('has a Become a sponsor button that opens the sponsorship enquiry', () => {
    renderAt('/');
    const banner = screen.getByRole('banner');
    expect(within(banner).getAllByRole('link', { name: 'Become a sponsor' })[0].getAttribute('href')).toBe(
      '/contact?service=sponsorship',
    );
  });

  it('marks Events as the current section on a series page', () => {
    renderAt('/events/build-expo');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Events' }).getAttribute('aria-current')).toBe('page');
  });

  it('opens a mobile menu with every page and the sponsor button, and closes it after a choice', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('navigation', { name: 'Mobile' });
    expect(within(menu).getAllByRole('link').map((a) => a.textContent)).toEqual([
      ...MAIN_NAV.map(([label]) => label),
      'Become a sponsor',
    ]);
    fireEvent.click(within(menu).getByRole('link', { name: 'About' }));
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy();
  });

  it('uses no glass, gradient or blur effects', () => {
    renderAt('/');
    expect(screen.getByRole('banner').outerHTML).not.toMatch(/glass|gradient|blur/);
  });
});

describe('footer', () => {
  it('links every event series and shows the WhatsApp number', () => {
    renderAt('/');
    const footer = screen.getByRole('contentinfo');
    for (const series of EVENT_SERIES) {
      expect(within(footer).getByRole('link', { name: series.name }).getAttribute('href')).toBe(seriesPath(series.slug));
    }
    expect(within(footer).getByText(/\+960 799-7974/)).toBeTruthy();
    expect(footer.outerHTML).not.toMatch(/glass|gradient|blur/);
  });

  it('links staff to the admin sign-in page without inviting crawlers', () => {
    renderAt('/');
    const link = within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Staff login' });
    expect(link.getAttribute('href')).toBe('http://localhost:3010/login');
    expect(link.getAttribute('rel')).toContain('nofollow');
  });
});
