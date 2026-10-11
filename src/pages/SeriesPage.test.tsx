import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../AppRoutes';
import { contactPath } from '../routes';

vi.mock('../lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const main = () => screen.getByRole('main');

describe('SeriesPage', () => {
  it('shows the Construction Industry Forum with its endorsement, website, editions and partners', () => {
    renderAt('/events/construction-industry-forum');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Construction Industry Forum');
    expect(within(main()).getByText('Endorsed by MNACI')).toBeTruthy();
    const site = within(main()).getByRole('link', { name: /cif\.mv/ });
    expect(site.getAttribute('href')).toBe('https://cif.mv');
    expect(site.getAttribute('target')).toBe('_blank');

    const editions = within(main()).getAllByRole('article');
    expect(editions.map((e) => within(e).getByRole('heading').textContent)).toEqual([
      'Construction Industry Forum 2025',
      'Construction Industry Forum 2024',
      'Construction Industry Forum 2023',
    ]);
    expect(within(main()).queryByText(/Aviation Forum 20/)).toBeNull();
    expect(within(main()).getByText('Ooredoo Maldives')).toBeTruthy();
    expect(within(main()).getByText('Exclusive Platinum Sponsor, CIF 2026')).toBeTruthy();
  });

  it('pre-fills the enquiry with the series name, including its dash', () => {
    renderAt('/events/aviation-forum');
    const cta = within(main()).getAllByRole('link', { name: 'Become a sponsor' })[0];
    expect(cta.getAttribute('href')).toBe(contactPath({ event: 'Aviation Forum – Connecting Maldives' }));

    fireEvent.click(cta);
    const message = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(message.value).toContain('Aviation Forum – Connecting Maldives');
  });

  it('uses the singular for a series with one edition and offers stand booking', () => {
    renderAt('/events/build-expo');
    expect(within(main()).getByText('1 edition')).toBeTruthy();
    expect(within(main()).queryByText('1 editions')).toBeNull();
    expect(within(main()).getByRole('link', { name: 'Book a stand' })).toBeTruthy();
  });

  it('says the next edition is to be announced', () => {
    renderAt('/events/marine-industry-forum');
    expect(within(main()).getByText(/Next edition: dates to be announced\./)).toBeTruthy();
  });

  it('handles a trailing slash', () => {
    renderAt('/events/build-expo/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Build Expo');
  });

  it('shows the not-found page for an unknown series', () => {
    renderAt('/events/nope');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page not found');
    expect(within(main()).getByRole('link', { name: 'View all events' }).getAttribute('href')).toBe('/events');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryAllByRole('link', { current: 'page' })).toHaveLength(0);
    expect(screen.queryByRole('heading', { level: 1, name: 'Build Expo' })).toBeNull();
  });
});
