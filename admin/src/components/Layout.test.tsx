import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';
import type { StaffRole } from '../lib/types';
import { canSee } from '../lib/permissions';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

function renderAs(role: StaffRole, url = '/') {
  const user = makeUser({ id: `u-${role}`, role, full_name: 'Sam Example', email: `${role}@medium.test` });
  holder.fake = createFakeApi({ users: [user], signedInAs: user.id });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

const navLabels = async () =>
  within(await screen.findByRole('navigation', { name: 'Admin' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('permissions', () => {
  it('shows Staff only to admins', () => {
    expect(canSee('admin', 'staff')).toBe(true);
    for (const role of ['sales', 'events', 'finance'] as StaffRole[]) {
      expect(canSee(role, 'staff')).toBe(false);
      expect(canSee(role, 'dashboard')).toBe(true);
      expect(canSee(role, 'activity')).toBe(true);
      expect(canSee(role, 'account')).toBe(true);
    }
  });
});

describe('Layout', () => {
  it.each([
    ['admin', ['Dashboard', 'Events', 'Publish', 'Enquiries', 'Sponsors', 'Deals', 'Reports', 'Staff', 'Activity log', 'My account']],
    ['events', ['Dashboard', 'Events', 'Publish', 'Sponsors', 'Deals', 'Reports', 'Activity log', 'My account']],
    ['sales', ['Dashboard', 'Events', 'Enquiries', 'Sponsors', 'Deals', 'Reports', 'Activity log', 'My account']],
    ['finance', ['Dashboard', 'Events', 'Sponsors', 'Deals', 'Reports', 'Activity log', 'My account']],
  ] as [StaffRole, string[]][])('gives %s the right sections', async (role, labels) => {
    renderAs(role);
    expect(await navLabels()).toEqual(labels);
  });

  it('blocks non-admins from the Staff page', async () => {
    renderAs('finance', '/staff');
    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeTruthy();
  });

  it('shows who is signed in and their role', async () => {
    renderAs('events');
    const banner = await screen.findByRole('banner');
    expect(within(banner).getByText('Sam Example')).toBeTruthy();
    expect(within(banner).getByText('Events')).toBeTruthy();
  });

  it('signs out', async () => {
    renderAs('sales');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to MEDIUM Admin' })).toBeTruthy();
  });

  it('opens and closes the menu on small screens', async () => {
    renderAs('admin');
    const toggle = await screen.findByRole('button', { name: 'Open menu' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('shows a not-found page for unknown addresses', async () => {
    renderAs('admin', '/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
