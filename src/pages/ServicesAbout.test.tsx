import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../AppRoutes';
import { SERVICES_DATA } from '../data/websiteData';
import { contactPath } from '../routes';

vi.mock('../lib/analytics', () => ({ initAnalytics: vi.fn(), trackPageView: vi.fn(), trackEvent: vi.fn() }));

function renderMain(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return screen.getByRole('main');
}

const HYPE = /nation-scale|mandate|bespoke|indelible|paramount|curate/i;

describe('ServicesPage', () => {
  it('lists each service with a proposal link for that service', () => {
    const main = renderMain('/services');
    expect(within(main).getByRole('heading', { level: 1 })).toBeTruthy();
    for (const service of SERVICES_DATA) {
      const heading = within(main).getByRole('heading', { level: 2, name: service.title });
      const block = heading.closest('[data-service]') as HTMLElement;
      expect(within(block).getByRole('link', { name: /Request a proposal/ }).getAttribute('href')).toBe(
        contactPath({ service: service.id }),
      );
      for (const feature of service.features) expect(within(block).getByText(feature)).toBeTruthy();
    }
    expect(main.textContent).not.toMatch(HYPE);
  });
});

describe('AboutPage', () => {
  it('explains who MEDIUM is with verified facts', () => {
    const main = renderMain('/about');
    expect(within(main).getByRole('heading', { level: 1 })).toBeTruthy();
    expect(main.textContent).toContain('60 years of combined experience');
    expect(main.textContent).toContain('15 years');
    const principles = within(main).getByRole('list', { name: 'How we work' });
    expect(within(principles).getAllByRole('listitem')).toHaveLength(5);
    for (const value of ['9', '4', '2023', '60+']) expect(within(main).getByText(value)).toBeTruthy();
    for (const partner of ['MNACI', 'Ooredoo Maldives', 'SITA']) expect(within(main).getByText(partner)).toBeTruthy();
    expect(main.textContent).not.toMatch(HYPE);
  });
});
