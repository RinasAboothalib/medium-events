import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

const me = makeUser({ id: 'u-me', full_name: 'Aisha Admin', email: 'aisha@medium.mv', role: 'admin' });
const sam = makeUser({ id: 'u-sam', full_name: 'Sam Sales', email: 'sam@medium.mv', role: 'sales' });
const fay = makeUser({ id: 'u-fay', full_name: 'Fay Finance', email: 'fay@medium.mv', role: 'finance', active: false });

const writes = () => holder.fake.state.calls.filter((c) => c.method !== 'GET');

beforeEach(() => {
  holder.fake = createFakeApi({ users: [me, sam, fay], signedInAs: 'u-me' });
  render(
    <MemoryRouter initialEntries={['/staff']}>
      <AdminRoutes />
    </MemoryRouter>,
  );
});

const rowFor = async (name: string) => (await screen.findByRole('cell', { name })).closest('tr') as HTMLElement;

describe('StaffPage', () => {
  it('lists every staff member with role and status', async () => {
    expect(await screen.findByRole('heading', { level: 1, name: 'Staff' })).toBeTruthy();
    const fayRow = await rowFor('Fay Finance');
    expect(within(fayRow).getByText('fay@medium.mv')).toBeTruthy();
    expect(within(fayRow).getByText('Deactivated')).toBeTruthy();
    expect(within(await rowFor('Sam Sales')).getByText('Active')).toBeTruthy();
  });

  const openAddForm = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Add staff' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'New@Medium.mv' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'Temporary-123' } });
  };

  it('validates a new account before creating it', async () => {
    await openAddForm();
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('The temporary password needs at least 10 characters.')).toBeTruthy();
    expect(writes()).toHaveLength(0);
  });

  it('creates an account with a temporary password, without sending email', async () => {
    await openAddForm();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText(
        "Account created for new@medium.mv. Give them the temporary password; they'll choose their own when they first sign in.",
      ),
    ).toBeTruthy();
    expect(writes()).toEqual([
      { method: 'POST', path: '/staff', body: { email: 'new@medium.mv', full_name: 'New Person', role: 'events', temp_password: 'Temporary-123' } },
    ]);
    expect(await rowFor('New Person')).toBeTruthy();
  });

  it('shows the server error when an account is refused', async () => {
    await openAddForm();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@medium.mv' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('That email already has an account.')).toBeTruthy();
  });

  it('sets a temporary password for someone who forgot theirs', async () => {
    const row = await rowFor('Sam Sales');
    fireEvent.click(within(row).getByRole('button', { name: 'Reset password' }));
    fireEvent.change(screen.getByLabelText('Temporary password for Sam Sales'), { target: { value: 'Temporary-456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set temporary password' }));
    expect(await screen.findByText('Temporary password set for Sam Sales. They must choose a new one when they sign in.')).toBeTruthy();
    expect(writes()).toEqual([{ method: 'POST', path: '/staff/u-sam/reset-password', body: { temp_password: 'Temporary-456' } }]);
  });

  it("doesn't let you change your own access", async () => {
    const myRow = await rowFor('Aisha Admin');
    const select = within(myRow).getByLabelText('Role for Aisha Admin') as HTMLSelectElement;
    const button = within(myRow).getByRole('button', { name: 'Deactivate' });
    expect((within(myRow).getByRole('button', { name: 'Reset password' }) as HTMLButtonElement).disabled).toBe(true);
    expect(select.disabled).toBe(true);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('title')).toBe("You can't change your own access");
  });

  it('changes another person’s role', async () => {
    const row = await rowFor('Sam Sales');
    fireEvent.change(within(row).getByLabelText('Role for Sam Sales'), { target: { value: 'finance' } });
    await waitFor(() => expect(writes()).toEqual([{ method: 'PATCH', path: '/staff/u-sam', body: { role: 'finance' } }]));
    expect(await screen.findByText('Saved changes for Sam Sales.')).toBeTruthy();
  });

  it('asks for confirmation before deactivating', async () => {
    const row = await rowFor('Sam Sales');
    fireEvent.click(within(row).getByRole('button', { name: 'Deactivate' }));
    expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, deactivate Sam Sales' }));
    await waitFor(() => expect(writes()).toEqual([{ method: 'PATCH', path: '/staff/u-sam', body: { active: false } }]));
    expect(within(await rowFor('Sam Sales')).getByText('Deactivated')).toBeTruthy();
  });

  it('reactivates a deactivated person', async () => {
    const row = await rowFor('Fay Finance');
    fireEvent.click(within(row).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => expect(writes()).toEqual([{ method: 'PATCH', path: '/staff/u-fay', body: { active: true } }]));
  });

  it('explains the last-admin rule when the server refuses', async () => {
    const row = await rowFor('Sam Sales');
    holder.fake.state.failNext = { status: 409, error: 'There must always be at least one active admin.' };
    fireEvent.change(within(row).getByLabelText('Role for Sam Sales'), { target: { value: 'events' } });
    expect(await screen.findByText('There must always be at least one active admin.')).toBeTruthy();
  });
});
