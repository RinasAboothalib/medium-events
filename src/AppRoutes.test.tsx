import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { AppRoutes } from './AppRoutes';
import { contactPath } from './routes';
import { trackPageView } from './lib/analytics';

vi.mock('./lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('renders the Events page at /events', async () => {
    renderAt('/events');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Events');
    expect(screen.getByRole('heading', { name: "Events we've delivered" })).toBeTruthy();
    expect(screen.getByRole('main').textContent).not.toMatch(/every year|annual series/i);
    expect(within(screen.getByRole('main')).getAllByRole('article')).toHaveLength(9);
    for (const label of ['All', 'Construction Industry Forum', 'Marine Industry Forum', 'Aviation Forum', 'Build Expo']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    for (const slug of ['construction-industry-forum', 'marine-industry-forum', 'aviation-forum', 'build-expo']) {
      expect(within(screen.getByRole('main')).getAllByRole('link').some((a) => a.getAttribute('href') === '/events/' + slug)).toBe(true);
    }
  });

  it('renders the News page at /news', async () => {
    renderAt('/news');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('News and announcements');
  });

  it('redirects legacy hash links on the home page', async () => {
    renderAt('/#events');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Events');
    expect(screen.getByTestId('location').textContent).toBe('/events');
  });

  it('ignores hashes on other pages', async () => {
    renderAt('/about#events');
    await screen.findAllByRole('heading');
    expect(screen.getByTestId('location').textContent).toBe('/about');
  });

  it('links navigation to real URLs', async () => {
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link', { name: 'News' })[0].getAttribute('href')).toBe('/news');
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('/contact');
  });

  it('links the events page sponsor band to the sponsorship enquiry', async () => {
    renderAt('/events');
    const links = await within(screen.getByRole('main')).findAllByRole('link', { name: 'Become a sponsor' });
    expect(links[0].getAttribute('href')).toBe(contactPath({ service: 'sponsorship' }));
  });

  it('reports page views under the canonical path', async () => {
    renderAt('/contact/');
    await screen.findAllByRole('heading');
    expect(trackPageView).toHaveBeenCalledWith('/contact', 'Contact and sponsorship | MEDIUM Events Maldives');
  });

  it('shows the not-found page for unknown addresses', async () => {
    renderAt('/does-not-exist');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Page not found');
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Go to the home page' }).getAttribute('href')).toBe('/');
  });
});
