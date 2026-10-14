import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const cif = makeSeries();
const expo = makeSeries({ id: 's-expo', slug: 'build-expo', name: 'Build Expo', label: 'Build Expo', short_name: 'Build Expo', sort_order: 4 });
const cif2025 = makeEdition();

function renderAs(role: StaffRole, url: string) {
  const user = makeUser({ id: `u-${role}`, role, email: `${role}@medium.test` });
  holder.fake = createFakeApi({ users: [user], signedInAs: user.id, series: [cif, expo], editions: [cif2025], partners: [{ id: 'p-1', name: 'MNACI', role: 'Endorsing association', series_id: 's-cif', edition_id: null, sort_order: 1 }] });
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

const writes = () => holder.fake.state.calls.filter((c) => c.method !== 'GET');

describe('Events list', () => {
  it('lists the series with their edition counts', async () => {
    renderAs('events', '/events');
    const row = (await screen.findByRole('link', { name: 'Construction Industry Forum' })).closest('tr')!;
    expect(within(row).getByText('1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Build Expo' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add series' })).toBeTruthy();
  });

  it('is read-only for sales', async () => {
    renderAs('sales', '/events');
    await screen.findByRole('link', { name: 'Construction Industry Forum' });
    expect(screen.queryByRole('link', { name: 'Add series' })).toBeNull();
    expect(screen.getByText('You can view events. Only admins and the events team can change them.')).toBeTruthy();
  });
});

describe('Series editor', () => {
  it('creates a series and opens it', async () => {
    renderAs('admin', '/events/new');
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Maldives Tourism Forum' } });
    fireEvent.change(screen.getByLabelText('Web address'), { target: { value: 'tourism-forum' } });
    fireEvent.change(screen.getByLabelText('Card label'), { target: { value: 'Tourism Forum' } });
    fireEvent.change(screen.getByLabelText('Short name'), { target: { value: 'MTF' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'One.\n\nTwo.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save series' }));
    await waitFor(() => expect(writes()[0]).toEqual(expect.objectContaining({ method: 'POST', path: '/series' })));
    expect(writes()[0].body).toEqual(expect.objectContaining({ name: 'Maldives Tourism Forum', slug: 'tourism-forum', description: ['One.', 'Two.'], website: null }));
    expect(await screen.findByRole('heading', { name: 'Maldives Tourism Forum' })).toBeTruthy();
  });

  it('shows partners and editions of a series', async () => {
    renderAs('events', '/events/s-cif');
    expect(await screen.findByText('MNACI')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Construction Industry Forum 2025' })).toBeTruthy();
  });

  it('adds and removes a partner', async () => {
    renderAs('events', '/events/s-cif');
    await screen.findByText('MNACI');
    fireEvent.change(screen.getByLabelText('Partner name'), { target: { value: 'Ooredoo Maldives' } });
    fireEvent.change(screen.getByLabelText('Partner role'), { target: { value: 'Platinum Sponsor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add partner' }));
    expect(await screen.findByText('Ooredoo Maldives')).toBeTruthy();
    expect(writes()[0]).toEqual({ method: 'POST', path: '/partners', body: { name: 'Ooredoo Maldives', role: 'Platinum Sponsor', series_id: 's-cif' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove MNACI' }));
    await waitFor(() => expect(screen.queryByText('MNACI')).toBeNull());
  });

  it("shows the server's message when deleting a series that has editions", async () => {
    renderAs('admin', '/events/s-cif');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete series' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete Construction Industry Forum' }));
    expect(await screen.findByText("Remove this series' editions first.")).toBeTruthy();
  });

  it('disables the form for read-only roles', async () => {
    renderAs('finance', '/events/s-cif');
    expect(((await screen.findByLabelText('Name')) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save series' })).toBeNull();
  });
});

describe('Edition editor', () => {
  it('records attendance and outcome notes', async () => {
    renderAs('events', '/events/editions/e-cif-2025');
    fireEvent.change(await screen.findByLabelText('Attendance'), { target: { value: '240' } });
    fireEvent.change(screen.getByLabelText('Outcome notes'), { target: { value: 'Full house.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save edition' }));
    await waitFor(() => expect(writes()[0]).toEqual(expect.objectContaining({ method: 'PATCH', path: '/editions/e-cif-2025' })));
    expect(writes()[0].body).toEqual(expect.objectContaining({ attendance: 240, outcome_notes: 'Full house.', rsvp_count: 200, end_date: null }));
    expect(await screen.findByText('Saved.')).toBeTruthy();
  });

  it('creates an edition inside a series', async () => {
    renderAs('admin', '/events/s-expo/editions/new');
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Build Expo 2027' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-04-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save edition' }));
    await waitFor(() => expect(writes()[0]).toEqual(expect.objectContaining({ method: 'POST', path: '/editions' })));
    expect(writes()[0].body).toEqual(expect.objectContaining({ series_id: 's-expo', name: 'Build Expo 2027', start_date: '2027-04-20', status: 'upcoming' }));
  });

  it('rejects a banner that is not an image before uploading', async () => {
    renderAs('events', '/events/editions/e-cif-2025');
    const input = await screen.findByLabelText('Banner image');
    fireEvent.change(input, { target: { files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Upload a JPG, PNG or WebP image.')).toBeTruthy();
    expect(writes()).toHaveLength(0);
  });

  it('uploads a banner and saves it on the edition', async () => {
    renderAs('events', '/events/editions/e-cif-2025');
    const input = await screen.findByLabelText('Banner image');
    fireEvent.change(input, { target: { files: [new File(['x'], 'banner.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(writes()[0]).toEqual(expect.objectContaining({ method: 'POST', path: '/files?filename=banner.jpg' })));
    fireEvent.click(screen.getByRole('button', { name: 'Save edition' }));
    await waitFor(() => expect(writes()[1].body).toEqual(expect.objectContaining({ banner_file_id: 'new-1' })));
  });
});
