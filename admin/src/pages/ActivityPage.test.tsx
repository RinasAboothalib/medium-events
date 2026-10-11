import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';
import type { ActivityRow, StaffRole } from '../lib/types';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

const admin = makeUser({ id: 'u-admin', full_name: 'Aisha Admin', role: 'admin' });
const sales = makeUser({ id: 'u-sales', full_name: 'Sam Sales', email: 'sam@medium.test', role: 'sales' });

const ROWS: ActivityRow[] = [
  {
    id: 3,
    at: '2026-10-12T04:30:00Z',
    actor_id: 'u-admin',
    actor_name: 'Aisha Admin',
    entity: 'users',
    entity_id: 'u-sales',
    action: 'update',
    changes: { role: { old: 'events', new: 'sales' }, full_name: { old: 'Sam', new: 'Sam Sales' } },
  },
  { id: 2, at: '2026-10-11T05:00:00Z', actor_id: 'u-old', actor_name: null, entity: 'users', entity_id: 'u-sales', action: 'create', changes: {} },
  { id: 1, at: '2026-10-11T03:00:00Z', actor_id: null, actor_name: null, entity: 'users', entity_id: 'u-admin', action: 'login', changes: {} },
];

function renderAs(role: StaffRole, activityTotal?: number) {
  const me = role === 'admin' ? admin : sales;
  holder.fake = createFakeApi({ users: [admin, sales], signedInAs: me.id, activity: ROWS, activityTotal });
  render(
    <MemoryRouter initialEntries={['/activity']}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

const activityPaths = () => holder.fake.state.calls.filter((c) => c.path.startsWith('/activity')).map((c) => c.path);
const lastPath = () => activityPaths().at(-1);

beforeEach(() => vi.clearAllMocks());

describe('ActivityPage', () => {
  it('shows who did what, when, in Maldives time', async () => {
    renderAs('admin');
    await screen.findByText('12 Oct 2026, 09:30');
    const rows = screen.getAllByRole('row');
    const first = rows[1];
    expect(within(first).getByText('Aisha Admin')).toBeTruthy();
    expect(within(first).getByText('Updated')).toBeTruthy();
    expect(within(first).getByText('Staff')).toBeTruthy();
    expect(within(first).getByText('role: "events" → "sales"; full_name: "Sam" → "Sam Sales"')).toBeTruthy();
    expect(within(rows[2]).getByText('Former staff')).toBeTruthy();
    expect(within(rows[2]).getByText('Created')).toBeTruthy();
    expect(within(rows[3]).getByText('System')).toBeTruthy();
    expect(within(rows[3]).getByText('Signed in')).toBeTruthy();
  });

  it('loads the first page with no filters', async () => {
    renderAs('admin');
    await screen.findAllByRole('row');
    expect(lastPath()).toBe('/activity?page=0');
  });

  it('pages through long histories', async () => {
    renderAs('admin', 120);
    await screen.findByText('Page 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastPath()).toBe('/activity?page=1'));
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy();
  });

  it('filters by person, action and dates', async () => {
    renderAs('admin');
    await screen.findByRole('option', { name: 'Sam Sales' });
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'u-sales' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'update' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-31' } });
    await waitFor(() => expect(lastPath()).toBe('/activity?actor=u-sales&action=update&from=2026-10-01&to=2026-10-31&page=0'));
  });

  it('offers sign-ins as an action filter', async () => {
    renderAs('admin');
    expect(await screen.findByRole('option', { name: 'Signed in' })).toBeTruthy();
  });

  it('does not offer the person filter to non-admins', async () => {
    renderAs('sales');
    await screen.findAllByRole('row');
    expect(screen.queryByLabelText('Person')).toBeNull();
    expect(screen.getByText('Showing your own activity.')).toBeTruthy();
  });

  it('shows a load error from the server', async () => {
    renderAs('admin');
    await screen.findByRole('option', { name: 'Sam Sales' });
    await screen.findByText('12 Oct 2026, 09:30');
    holder.fake.state.failNext = { status: 500, error: 'Something went wrong. Try again.' };
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'delete' } });
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
  });
});
