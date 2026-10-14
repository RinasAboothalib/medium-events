import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';
import { makeEdition, makeSeries } from '../test/fakeEvents';
import type { PublishInfo, StaffRole } from '../lib/types';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

function renderAs(role: StaffRole, published: PublishInfo | null = null) {
  const user = makeUser({ id: `u-${role}`, role, email: `${role}@medium.test` });
  holder.fake = createFakeApi({ users: [user], signedInAs: user.id, series: [makeSeries()], editions: [makeEdition()], published });
  render(
    <MemoryRouter initialEntries={['/publish']}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

describe('PublishPage', () => {
  it('says when the website has never been updated from here', async () => {
    renderAs('events');
    expect(await screen.findByText("The website hasn't been updated from the admin yet. It shows its built-in event list.")).toBeTruthy();
  });

  it('shows the last publish in Maldives time', async () => {
    renderAs('admin', { published_at: '2026-10-12T04:30:00Z', published_by_name: 'Aisha Admin', series: 4, events: 9 });
    expect(await screen.findByText('Last updated 12 Oct 2026, 09:30 by Aisha Admin: 4 series and 9 events.')).toBeTruthy();
  });

  it('publishes after confirmation', async () => {
    renderAs('events');
    fireEvent.click(await screen.findByRole('button', { name: 'Publish to website' }));
    expect(holder.fake.state.calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, publish now' }));
    expect(await screen.findByText('Published 1 series and 1 event.')).toBeTruthy();
  });

  it('is not available to sales', async () => {
    renderAs('sales');
    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeTruthy();
  });
});
