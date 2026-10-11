import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../AppRoutes';

vi.mock('../lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

function renderMain(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return screen.getByRole('main');
}

describe('ContactPage', () => {
  it('shows contact details with opening hours in Maldives time', () => {
    const main = renderMain('/contact');
    expect(within(main).getByRole('heading', { level: 1 })).toBeTruthy();
    expect(within(main).getByText('Sunday – Thursday, 09:00 – 17:00 (Maldives time, UTC+5)')).toBeTruthy();
    expect(within(main).getByText(/\+960 799-7974/)).toBeTruthy();
    expect(within(main).getByText('info@medium.mv')).toBeTruthy();
  });
});

describe('NewsPage', () => {
  it('lists only the verified news items', () => {
    const main = renderMain('/news');
    expect(within(main).getByRole('heading', { level: 1 })).toBeTruthy();
    const titles = within(main).getAllByRole('article').map((a) => within(a).getByRole('heading').textContent);
    expect(titles).toEqual([
      'Ooredoo Maldives Signs On as Exclusive Platinum Sponsor of CIF 2026',
      'Aviation Forum 2026 Convenes Maldivian Aviation Leaders at Hotel JEN Malé',
    ]);
  });
});
