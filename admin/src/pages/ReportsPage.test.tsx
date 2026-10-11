import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';
import { makeEdition, makeSeries } from '../test/fakeEvents';
import type { StaffRole } from '../lib/types';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

function renderAs(role: StaffRole, url = '/reports', dashboard?: { id: string; label: string; value: string }[]) {
  const user = makeUser({ id: `u-${role}`, role, full_name: `Sam ${role}`, email: `${role}@medium.test` });
  holder.fake = createFakeApi({ users: [user], signedInAs: user.id, series: [makeSeries()], editions: [makeEdition()], dashboard });
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

const headings = async () => {
  await screen.findByRole('heading', { level: 1, name: 'Reports' });
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
};

describe('Reports', () => {
  it.each([
    ['admin', ['Post-event report', 'Sponsorship report', 'Enquiries report', 'Delegates report', 'Budget report']],
    ['events', ['Post-event report', 'Delegates report']],
    ['sales', ['Sponsorship report', 'Enquiries report']],
    ['finance', ['Sponsorship report', 'Budget report']],
  ] as [StaffRole, string[]][])('offers %s only their reports', async (role, expected) => {
    renderAs(role);
    expect(await headings()).toEqual(expected);
  });

  it('builds the post-event download for the chosen edition', async () => {
    renderAs('events');
    const section = (await screen.findByRole('heading', { name: 'Post-event report' })).closest('section')!;
    await within(section).findByRole('option', { name: 'Construction Industry Forum 2025' });
    expect(within(section).queryByRole('link', { name: 'Download PDF' })).toBeNull();
    fireEvent.change(within(section).getByLabelText('Event'), { target: { value: 'e-cif-2025' } });
    expect(within(section).getByRole('link', { name: 'Download PDF' }).getAttribute('href')).toBe('/api/reports/post-event/e-cif-2025.pdf');
  });

  it('builds sponsorship downloads for an event or a date range', async () => {
    renderAs('finance');
    const section = (await screen.findByRole('heading', { name: 'Sponsorship report' })).closest('section')!;
    expect(within(section).getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/sponsorship.xlsx');
    fireEvent.change(within(section).getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(within(section).getByLabelText('To'), { target: { value: '2026-12-31' } });
    expect(within(section).getByRole('link', { name: 'Download PDF' }).getAttribute('href')).toBe('/api/reports/sponsorship.pdf?from=2026-01-01&to=2026-12-31');
    await within(section).findByRole('option', { name: 'Construction Industry Forum 2025' });
    fireEvent.change(within(section).getByLabelText('Event'), { target: { value: 'e-cif-2025' } });
    expect(within(section).getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/sponsorship.xlsx?edition_id=e-cif-2025');
  });

  it('builds the enquiries download with its filters', async () => {
    renderAs('sales');
    const section = (await screen.findByRole('heading', { name: 'Enquiries report' })).closest('section')!;
    fireEvent.change(within(section).getByLabelText('Status'), { target: { value: 'won' } });
    fireEvent.change(within(section).getByLabelText('Source'), { target: { value: 'website' } });
    expect(within(section).getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/enquiries.xlsx?status=won&source=website');
  });
});

describe('Edition reports', () => {
  it('builds the delegates download with its filters', async () => {
    renderAs('events');
    const section = (await screen.findByRole('heading', { name: 'Delegates report' })).closest('section')!;
    expect(within(section).getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/delegates.xlsx');
    await within(section).findByRole('option', { name: 'Construction Industry Forum 2025' });
    fireEvent.change(within(section).getByLabelText('Event'), { target: { value: 'e-cif-2025' } });
    fireEvent.change(within(section).getByLabelText('Status'), { target: { value: 'attended' } });
    expect(within(section).getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/delegates.xlsx?edition_id=e-cif-2025&status=attended');
  });

  it('builds the budget download for one event or all of them', async () => {
    renderAs('finance');
    const section = (await screen.findByRole('heading', { name: 'Budget report' })).closest('section')!;
    expect(within(section).getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/budget.xlsx');
    await within(section).findByRole('option', { name: 'Construction Industry Forum 2025' });
    fireEvent.change(within(section).getByLabelText('Event'), { target: { value: 'e-cif-2025' } });
    expect(within(section).getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/budget.xlsx?edition_id=e-cif-2025');
  });
});

describe('Dashboard figures', () => {
  it("shows the server's figures for the role", async () => {
    renderAs('finance', '/', [
      { id: 'outstanding_MVR', label: 'Outstanding (MVR)', value: 'MVR 20,000.00' },
      { id: 'payments_month', label: 'Received this month', value: 'USD 250.00' },
    ]);
    const figures = await screen.findByRole('region', { name: 'At a glance' });
    expect(within(figures).getByText('Outstanding (MVR)')).toBeTruthy();
    expect(within(figures).getByText('MVR 20,000.00')).toBeTruthy();
    expect(within(figures).getByText('USD 250.00')).toBeTruthy();
  });

  it('shows no figures section when there are none', async () => {
    renderAs('finance', '/', []);
    await screen.findByText('Welcome, Sam');
    expect(screen.queryByRole('region', { name: 'At a glance' })).toBeNull();
  });
});
