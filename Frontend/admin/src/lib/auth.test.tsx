import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  get api() {
    return holder.fake.api;
  },
}));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

async function signInViaForm(email = 'admin@medium.test', password = 'correct-password') {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  holder.fake = createFakeApi({ users: [makeUser()] });
});

describe('signing in', () => {
  it('sends signed-out visitors to the sign-in page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Sign in to MEDIUM Admin' })).toBeTruthy();
  });

  it('shows the server message for a wrong password', async () => {
    renderAt('/');
    await signInViaForm('admin@medium.test', 'wrong');
    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });

  it('signs in and shows the dashboard', async () => {
    renderAt('/');
    await signInViaForm();
    expect(await screen.findByText('Welcome, Aisha')).toBeTruthy();
    expect(screen.getByText('Signed in as Admin')).toBeTruthy();
  });

  it('explains how to get a forgotten password reset, without email', async () => {
    renderAt('/login');
    expect(await screen.findByText('Forgot your password? Ask a MEDIUM admin to set a temporary one.')).toBeTruthy();
  });
});

describe('during a session', () => {
  it('signs out someone whose session ended, for example after being deactivated', async () => {
    renderAt('/');
    await signInViaForm();
    await screen.findByText('Welcome, Aisha');
    holder.fake.state.users[0].active = false;
    fireEvent.click(screen.getByRole('link', { name: 'Activity log' }));
    expect(await screen.findByText('Your session has ended. Sign in again.')).toBeTruthy();
  });

  it('picks up a role change on the next navigation', async () => {
    renderAt('/');
    await signInViaForm();
    await screen.findByText('Signed in as Admin');
    holder.fake.state.users[0].role = 'sales';
    fireEvent.click(screen.getByRole('link', { name: 'Activity log' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByText('Signed in as Sales')).toBeTruthy();
  });

  it('signs out', async () => {
    renderAt('/');
    await signInViaForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to MEDIUM Admin' })).toBeTruthy();
    expect(holder.fake.state.sessionUserId).toBeNull();
  });
});

describe('first sign-in password change', () => {
  const fill = (current: string, password: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
  };

  beforeEach(() => {
    holder.fake = createFakeApi({ users: [makeUser({ must_change_password: true })] });
  });

  it('sends someone on a temporary password to choose a new one first', async () => {
    renderAt('/');
    await signInViaForm();
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeTruthy();
    expect(screen.queryByText('Welcome, Aisha')).toBeNull();
  });

  it('checks length and matching before sending', async () => {
    renderAt('/');
    await signInViaForm();
    await screen.findByLabelText('New password');
    fill('correct-password', 'short', 'short');
    expect(screen.getByText('Use at least 10 characters.')).toBeTruthy();
    fill('correct-password', 'long-enough-1', 'long-enough-2');
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect(holder.fake.state.calls.some((c) => c.path === '/auth/change-password')).toBe(false);
  });

  it('shows the server error for a wrong current password', async () => {
    renderAt('/');
    await signInViaForm();
    await screen.findByLabelText('New password');
    fill('not-it', 'long-enough-1', 'long-enough-1');
    expect(await screen.findByText('Your current password is incorrect.')).toBeTruthy();
  });

  it('saves the new password and opens the dashboard', async () => {
    renderAt('/');
    await signInViaForm();
    await screen.findByLabelText('New password');
    fill('correct-password', 'long-enough-1', 'long-enough-1');
    await waitFor(() =>
      expect(holder.fake.state.calls).toContainEqual({
        method: 'POST',
        path: '/auth/change-password',
        body: { current_password: 'correct-password', new_password: 'long-enough-1' },
      }),
    );
    expect(await screen.findByText('Welcome, Aisha')).toBeTruthy();
  });
});

describe('my account', () => {
  it('lets anyone change their password at any time', async () => {
    holder.fake = createFakeApi({ users: [makeUser()], signedInAs: 'u-admin' });
    renderAt('/account');
    fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: 'correct-password' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'long-enough-1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'long-enough-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Password changed.')).toBeTruthy();
  });
});
