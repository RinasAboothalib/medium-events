import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';
import { makeEnquiry } from '../test/fakeEnquiries';
import type { StaffRole } from '../lib/types';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

const sales = makeUser({ id: 'u-sales', role: 'sales', full_name: 'Sam Sales', email: 'sam@medium.test' });
const admin = makeUser();
const fay = makeUser({ id: 'u-fay', role: 'finance', full_name: 'Fay Finance', email: 'fay@medium.test' });
const mariyam = makeEnquiry();
const hassan = makeEnquiry({ id: 'q-2', full_name: 'Hassan Rasheed', company: '', email: '', phone: '+960 999 0000', source: 'phone', status: 'contacted', created_at: '2026-10-11T04:30:00Z' });

function renderAs(role: StaffRole, url: string) {
  const me = role === 'sales' ? sales : makeUser({ id: `u-${role}`, role, email: `${role}@medium.test` });
  holder.fake = createFakeApi({ users: [me, admin, fay], signedInAs: me.id, enquiries: [mariyam, hassan] });
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

const lastList = () => holder.fake.state.calls.filter((c) => c.path.startsWith('/enquiries?')).at(-1)?.path;

describe('Enquiries list', () => {
  it('lists enquiries with their source, status and date', async () => {
    renderAs('sales', '/enquiries');
    const row = (await screen.findByRole('link', { name: 'Mariyam Ali' })).closest('tr')!;
    expect(within(row).getByText('Island Builders')).toBeTruthy();
    expect(within(row).getByText('Website')).toBeTruthy();
    expect(within(row).getByText('New')).toBeTruthy();
    expect(within(row).getByText('12 Oct 2026, 09:30')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hassan Rasheed' })).toBeTruthy();
  });

  it('filters by status, source and search text', async () => {
    renderAs('sales', '/enquiries');
    await screen.findByRole('link', { name: 'Mariyam Ali' });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'contacted' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'hassan' } });
    await waitFor(() => expect(lastList()).toBe('/enquiries?status=contacted&source=phone&q=hassan&page=0'));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Mariyam Ali' })).toBeNull());
    expect(screen.getByRole('link', { name: 'Hassan Rasheed' })).toBeTruthy();
  });

  it('is not available to events or finance', async () => {
    renderAs('events', '/enquiries');
    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeTruthy();
  });
});

describe('Adding an enquiry', () => {
  it('records a phone enquiry and opens it', async () => {
    renderAs('sales', '/enquiries/new');
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Aminath Hussain' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+960 777 0000' } });
    fireEvent.change(screen.getByLabelText('Came in by'), { target: { value: 'phone' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Asked about Build Expo stands.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save enquiry' }));
    await waitFor(() => expect(holder.fake.state.calls.some((c) => c.method === 'POST' && c.path === '/enquiries')).toBe(true));
    const post = holder.fake.state.calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual(expect.objectContaining({ full_name: 'Aminath Hussain', phone: '+960 777 0000', source: 'phone', message: 'Asked about Build Expo stands.' }));
    expect(await screen.findByRole('heading', { name: 'Aminath Hussain' })).toBeTruthy();
  });

  it("shows the server's field message", async () => {
    renderAs('sales', '/enquiries/new');
    fireEvent.click(await screen.findByRole('button', { name: 'Save enquiry' }));
    expect(await screen.findByText("Enter the person's name.")).toBeTruthy();
  });
});

describe('Enquiry detail', () => {
  it('shows the contact details and message', async () => {
    renderAs('sales', '/enquiries/q-1');
    expect(await screen.findByRole('heading', { name: 'Mariyam Ali' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'mariyam@islandbuilders.mv' }).getAttribute('href')).toBe('mailto:mariyam@islandbuilders.mv');
    expect(screen.getByText('We would like a stand.')).toBeTruthy();
    expect(screen.getByText('Construction Industry Forum 2026')).toBeTruthy();
  });

  it('changes the status and assigns it', async () => {
    renderAs('sales', '/enquiries/q-1');
    await screen.findByRole('option', { name: 'Aisha Admin' });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'proposal_sent' } });
    fireEvent.change(screen.getByLabelText('Assigned to'), { target: { value: 'u-admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(holder.fake.state.calls).toContainEqual({ method: 'PATCH', path: '/enquiries/q-1', body: { status: 'proposal_sent', assignee_id: 'u-admin' } }),
    );
    expect(await screen.findByText('Saved.')).toBeTruthy();
  });

  it('only offers people who handle enquiries as assignees', async () => {
    renderAs('sales', '/enquiries/q-1');
    await screen.findByRole('option', { name: 'Aisha Admin' });
    const options = [...(screen.getByLabelText('Assigned to') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual(['Nobody yet', 'Sam Sales', 'Aisha Admin']);
  });

  it('adds a note with author and time', async () => {
    renderAs('sales', '/enquiries/q-1');
    fireEvent.change(await screen.findByLabelText('New note'), { target: { value: 'Sent the stand price list.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    const note = (await screen.findByText('Sent the stand price list.', { selector: 'li p' })).closest('li')!;
    expect(within(note).getByText('Sam Sales · 13 Oct 2026, 10:15')).toBeTruthy();
    expect((screen.getByLabelText('New note') as HTMLTextAreaElement).value).toBe('');
  });
});
