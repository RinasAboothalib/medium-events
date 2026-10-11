import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';
import { makeEdition, makeSeries } from '../test/fakeEvents';
import { makeDeal, makeSponsor } from '../test/fakeSales';
import { makeDelegate, makeExpense, makeSession, makeSpeaker, makeTask } from '../test/fakeOperations';
import type { StaffRole } from '../lib/types';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

const EDITION = '/events/editions/e-cif-2025';

function renderAs(role: StaffRole, url: string) {
  const user = makeUser({ id: `u-${role}`, role, full_name: `Test ${role}`, email: `${role}@medium.test` });
  holder.fake = createFakeApi({
    users: [user, makeUser({ id: 'u-other', full_name: 'Ali Events', role: 'events', email: 'ali@medium.test' })],
    signedInAs: user.id,
    series: [makeSeries()],
    editions: [makeEdition()],
    sponsors: [makeSponsor()],
    deals: [makeDeal({ amount: 100000, outstanding: 100000 })],
    payments: [{ id: 'pay-1', deal_id: 'd-1', amount: 40000, paid_on: '2026-10-01', method: 'bank_transfer', invoice_no: '', notes: '', recorded_by_name: 'Fay Finance', created_at: '2026-10-01T05:00:00Z' }],
    tasks: [makeTask({ due_date: '2020-01-01' }), makeTask({ id: 't-2', title: 'Send invitations', status: 'done' })],
    speakers: [makeSpeaker()],
    sessions: [makeSession({ speakers: [{ id: 'sp-1', full_name: 'Aminath Shauna' }] })],
    delegates: [makeDelegate(), makeDelegate({ id: 'g-2', full_name: 'Bilal Naseem', company: 'Coral Homes', email: 'bilal@coral.mv', status: 'cancelled' })],
    expenses: [makeExpense()],
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

const writes = () => holder.fake.state.calls.filter((c) => c.method !== 'GET');
const tabs = async () =>
  within(await screen.findByRole('navigation', { name: 'Edition' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('Edition tabs', () => {
  it.each([
    ['admin', ['Details', 'Programme', 'Delegates', 'Tasks', 'Budget']],
    ['events', ['Details', 'Programme', 'Delegates', 'Tasks']],
    ['sales', ['Details', 'Programme', 'Delegates', 'Tasks']],
    ['finance', ['Details', 'Programme', 'Tasks', 'Budget']],
  ] as [StaffRole, string[]][])('gives %s the right tabs', async (role, labels) => {
    renderAs(role, EDITION);
    expect(await tabs()).toEqual(labels);
  });

  it('keeps the budget from the events team and the register from finance', async () => {
    renderAs('events', `${EDITION}/budget`);
    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeTruthy();
  });
});

describe('Tasks', () => {
  it('shows the checklist with what is overdue', async () => {
    renderAs('events', `${EDITION}/tasks`);
    const row = (await screen.findByText('Book the hall')).closest('tr')!;
    expect(within(row).getByText(/1 Jan 2020 \(overdue\)/)).toBeTruthy();
    expect(screen.getByText('1 open of 2')).toBeTruthy();
    expect(screen.getByText('· 1 overdue')).toBeTruthy();
  });

  it('adds a task and marks one done', async () => {
    renderAs('events', `${EDITION}/tasks`);
    await screen.findByText('Book the hall');
    const form = screen.getByRole('form', { name: 'Add task' });
    fireEvent.change(within(form).getByLabelText('Task'), { target: { value: 'Print badges' } });
    fireEvent.change(within(form).getByLabelText('Due date'), { target: { value: '2026-10-30' } });
    fireEvent.change(await within(form).findByLabelText('Assigned to'), { target: { value: 'u-other' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }));
    const added = (await screen.findByText('Print badges')).closest('tr')!;
    expect(within(added).getByText('Ali Events')).toBeTruthy();
    expect(writes()[0]).toEqual({ method: 'POST', path: '/tasks', body: { edition_id: 'e-cif-2025', title: 'Print badges', due_date: '2026-10-30', assignee_id: 'u-other' } });

    fireEvent.change(screen.getByLabelText('Status of Book the hall'), { target: { value: 'done' } });
    await waitFor(() => expect(writes()[1]).toEqual({ method: 'PATCH', path: '/tasks/t-1', body: { status: 'done' } }));
    expect(await screen.findByText('1 open of 3')).toBeTruthy();
  });

  it("shows the server's message when the title is missing, and is read-only for sales", async () => {
    renderAs('admin', `${EDITION}/tasks`);
    fireEvent.click(await screen.findByRole('button', { name: 'Add task' }));
    expect(await screen.findByText('Enter what needs doing.')).toBeTruthy();

    renderAs('sales', `${EDITION}/tasks`);
    expect(await screen.findByText('You can view tasks. Only admins and the events team can change them.')).toBeTruthy();
    await screen.findAllByText('Book the hall');
    expect(writes()).toHaveLength(0);
  });
});

describe('Programme', () => {
  it('shows sessions with their speakers, and speakers with their session counts', async () => {
    renderAs('finance', `${EDITION}/programme`);
    const session = (await screen.findByText('Opening keynote')).closest('li')!;
    expect(within(session).getByText('09:00–09:45')).toBeTruthy();
    expect(within(session).getByText('Main hall · Aminath Shauna')).toBeTruthy();
    const speakers = screen.getByRole('region', { name: 'Speakers' });
    expect(within(speakers).getByText('· 1 session')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add session' })).toBeNull();
  });

  it('adds a speaker, then a session with that speaker', async () => {
    renderAs('events', `${EDITION}/programme`);
    await screen.findByText('Opening keynote');
    fireEvent.change(screen.getByLabelText('Speaker name'), { target: { value: 'Hassan Ali' } });
    fireEvent.change(screen.getByLabelText('Organisation'), { target: { value: 'MNACI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add speaker' }));
    const form = screen.getByRole('form', { name: 'Add session' });
    fireEvent.click(await within(form).findByLabelText('Hassan Ali'));
    fireEvent.change(within(form).getByLabelText('Session title'), { target: { value: 'Panel: financing' } });
    fireEvent.change(within(form).getByLabelText('Type'), { target: { value: 'panel' } });
    fireEvent.change(within(form).getByLabelText('Starts'), { target: { value: '10:30' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add session' }));
    const added = (await screen.findByText('Panel: financing')).closest('li')!;
    expect(within(added).getByText('Hassan Ali')).toBeTruthy();
    expect(writes()[1]).toEqual({
      method: 'POST',
      path: '/sessions',
      body: { edition_id: 'e-cif-2025', title: 'Panel: financing', day: '2025-09-02', start_time: '10:30', end_time: null, room: '', kind: 'panel', description: '', speaker_ids: ['new-1'] },
    });
  });

  it('edits and removes a session', async () => {
    renderAs('events', `${EDITION}/programme`);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Opening keynote' }));
    const form = screen.getByRole('form', { name: 'Edit session' });
    expect((within(form).getByLabelText('Aminath Shauna') as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(form).getByLabelText('Room'), { target: { value: 'Hall B' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save session' }));
    expect(await screen.findByText('Hall B · Aminath Shauna')).toBeTruthy();
    expect(writes()[0]).toEqual(expect.objectContaining({ method: 'PATCH', path: '/sessions/ses-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Opening keynote' }));
    expect(await screen.findByText('No sessions yet.')).toBeTruthy();
  });
});

describe('Delegates', () => {
  it('shows the register with its head-counts', async () => {
    renderAs('sales', `${EDITION}/delegates`);
    expect(await screen.findByText('Mariyam Ali')).toBeTruthy();
    const summary = screen.getByLabelText('Register summary');
    expect(within(summary).getByText('On the register').nextElementSibling?.textContent).toBe('2');
    expect(within(summary).getByText('Expected').nextElementSibling?.textContent).toBe('1');
    expect(within(summary).getByText('Checked in').nextElementSibling?.textContent).toBe('0');
    // Sales can look people up but not change the register or export it
    expect(screen.queryByRole('button', { name: 'Check in Mariyam Ali' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Download Excel' })).toBeNull();
  });

  it('checks a delegate in and undoes it', async () => {
    renderAs('events', `${EDITION}/delegates`);
    fireEvent.click(await screen.findByRole('button', { name: 'Check in Mariyam Ali' }));
    expect(await screen.findByText('Mariyam Ali checked in.')).toBeTruthy();
    expect(writes()[0]).toEqual(expect.objectContaining({ method: 'POST', path: '/delegates/g-1/check-in' }));
    const row = screen.getByText('Mariyam Ali').closest('tr')!;
    expect(within(row).getByText('Attended')).toBeTruthy();
    expect(within(row).getByText('In at 13 Oct 2026, 10:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo check-in of Mariyam Ali' }));
    expect(await screen.findByRole('button', { name: 'Check in Mariyam Ali' })).toBeTruthy();
    // Cancelled registrations can't be checked in
    expect(screen.queryByRole('button', { name: 'Check in Bilal Naseem' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/delegates.xlsx?edition_id=e-cif-2025');
  });

  it('adds a delegate and refuses the same email twice', async () => {
    renderAs('events', `${EDITION}/delegates`);
    await screen.findByText('Mariyam Ali');
    const form = screen.getByRole('form', { name: 'Add delegate' });
    fireEvent.change(within(form).getByLabelText('Full name'), { target: { value: 'Zara Ibrahim' } });
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'mariyam@islandbuilders.mv' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add delegate' }));
    expect(await screen.findByText('Someone with that email is already registered for this event.')).toBeTruthy();
    expect(within(form).getByText('Already registered for this event.')).toBeTruthy();

    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'zara@example.mv' } });
    fireEvent.change(within(form).getByLabelText('Delegate category'), { target: { value: 'vip' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add delegate' }));
    expect(await screen.findByText('Zara Ibrahim added.')).toBeTruthy();
    expect(writes()[1].body).toEqual(expect.objectContaining({ edition_id: 'e-cif-2025', full_name: 'Zara Ibrahim', email: 'zara@example.mv', category: 'vip', status: 'registered' }));
  });

  it('searches and filters the register', async () => {
    renderAs('events', `${EDITION}/delegates`);
    await screen.findByText('Mariyam Ali');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'coral' } });
    await waitFor(() => expect(screen.queryByText('Mariyam Ali')).toBeNull());
    expect(screen.getByText('Bilal Naseem')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'attended' } });
    expect(await screen.findByText('No delegates match these filters.')).toBeTruthy();
  });

  it('asks before removing someone', async () => {
    renderAs('admin', `${EDITION}/delegates`);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Bilal Naseem' }));
    expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Bilal Naseem' }));
    expect(await screen.findByText('Bilal Naseem removed.')).toBeTruthy();
    expect(writes()[0]).toEqual(expect.objectContaining({ method: 'DELETE', path: '/delegates/g-2' }));
  });
});

describe('Budget', () => {
  it('sets sponsorship income against expenses', async () => {
    renderAs('finance', `${EDITION}/budget`);
    const summary = await screen.findByRole('region', { name: 'Income and expenses' });
    const row = (await within(summary).findByRole('rowheader', { name: 'MVR' })).closest('tr')!;
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['MVR 100,000.00', 'MVR 40,000.00', 'MVR 45,000.00', 'MVR 0.00', 'MVR 55,000.00', 'MVR 40,000.00']);
    expect(screen.getByRole('link', { name: 'Download Excel' }).getAttribute('href')).toBe('/api/reports/budget.xlsx?edition_id=e-cif-2025');
  });

  it('adds an expense, needing a date once it is paid', async () => {
    renderAs('finance', `${EDITION}/budget`);
    await screen.findByText('Hall hire');
    const form = screen.getByRole('form', { name: 'Add expense' });
    fireEvent.change(within(form).getByLabelText('What it is for'), { target: { value: 'Lunch for 200' } });
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'catering' } });
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '60,000' } });
    fireEvent.change(within(form).getByLabelText('Expense status'), { target: { value: 'paid' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add expense' }));
    expect(await screen.findByText('Enter the date it was paid.')).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Date paid'), { target: { value: '2026-10-10' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add expense' }));
    expect(await screen.findByText('Expense added.')).toBeTruthy();
    expect(writes()[1].body).toEqual(expect.objectContaining({ edition_id: 'e-cif-2025', description: 'Lunch for 200', category: 'catering', amount: '60,000', currency: 'MVR', status: 'paid', paid_on: '2026-10-10' }));
    // The edition now runs at a loss on paper: 100,000 confirmed against 105,000 of expenses
    expect(await screen.findByText('−MVR 5,000.00')).toBeTruthy();
    expect(screen.getByText('−MVR 20,000.00')).toBeTruthy();
  });

  it('edits and removes an expense', async () => {
    renderAs('admin', `${EDITION}/budget`);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Hall hire' }));
    const form = screen.getByRole('form', { name: 'Edit expense' });
    expect((within(form).getByLabelText('Amount') as HTMLInputElement).value).toBe('45000');
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '50000' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Expense saved.')).toBeTruthy();
    expect(writes()[0]).toEqual(expect.objectContaining({ method: 'PATCH', path: '/expenses/x-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hall hire' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove this expense' }));
    expect(await screen.findByText('No expenses yet.')).toBeTruthy();
  });
});
