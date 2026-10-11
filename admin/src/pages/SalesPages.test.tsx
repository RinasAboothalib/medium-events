import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminRoutes } from '../AdminRoutes';
import { createFakeApi, makeUser } from '../test/fakeApi';
import { makeEdition, makeSeries } from '../test/fakeEvents';
import { makeDeal, makeSponsor } from '../test/fakeSales';
import type { Payment, StaffRole } from '../lib/types';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeApi> }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  get api() {
    return holder.fake.api;
  },
}));

const ooredoo = makeSponsor();
const sita = makeSponsor({ id: 'sp-sita', company: 'SITA', contact_name: '', email: '' });
const mvrDeal = makeDeal();
const usdDeal = makeDeal({ id: 'd-2', sponsor_id: 'sp-sita', sponsor_company: 'SITA', package: 'Gold', amount: 1000, currency: 'USD', outstanding: 1000 });
const payment: Payment = { id: 'pay-1', deal_id: 'd-2', amount: 400, paid_on: '2026-10-01', method: 'bank_transfer', invoice_no: 'INV-001', notes: '', recorded_by_name: 'Fay Finance', created_at: '2026-10-01T05:00:00Z' };

function renderAs(role: StaffRole, url: string, payments: Payment[] = [payment]) {
  const user = makeUser({ id: `u-${role}`, role, full_name: `Test ${role}`, email: `${role}@medium.test` });
  holder.fake = createFakeApi({
    users: [user],
    signedInAs: user.id,
    series: [makeSeries()],
    editions: [makeEdition()],
    sponsors: [ooredoo, sita],
    deals: [mvrDeal, usdDeal],
    payments,
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes />
    </MemoryRouter>,
  );
}

const writes = () => holder.fake.state.calls.filter((c) => c.method !== 'GET');

describe('Sponsors', () => {
  it('lists sponsors and lets sales add one', async () => {
    renderAs('sales', '/sponsors');
    expect(await screen.findByRole('link', { name: 'Ooredoo Maldives' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Dhiraagu' } });
    fireEvent.change(screen.getByLabelText('Contact name'), { target: { value: 'Mohamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add sponsor' }));
    expect(await screen.findByRole('link', { name: 'Dhiraagu' })).toBeTruthy();
    expect(writes()[0]).toEqual({ method: 'POST', path: '/sponsors', body: { company: 'Dhiraagu', contact_name: 'Mohamed', email: '', phone: '' } });
  });

  it('shows a sponsor with its deals', async () => {
    renderAs('finance', '/sponsors/sp-ooredoo');
    expect(await screen.findByRole('heading', { name: 'Ooredoo Maldives' })).toBeTruthy();
    const row = (await screen.findByRole('link', { name: 'Platinum' })).closest('tr')!;
    // Amount and outstanding (nothing paid yet)
    expect(within(row).getAllByText('MVR 150,000.00')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Save sponsor' })).toBeNull();
  });

  it('does not let events staff add sponsors', async () => {
    renderAs('events', '/sponsors');
    await screen.findByRole('link', { name: 'Ooredoo Maldives' });
    expect(screen.queryByRole('button', { name: 'Add sponsor' })).toBeNull();
  });
});

describe('Deals', () => {
  it('lists deals with totals per currency', async () => {
    renderAs('sales', '/deals');
    const row = (await screen.findByRole('link', { name: 'Platinum' })).closest('tr')!;
    expect(within(row).getByText('Ooredoo Maldives')).toBeTruthy();
    expect(within(row).getAllByText('MVR 150,000.00')).toHaveLength(2);
    const totals = screen.getByRole('region', { name: 'Totals' });
    expect(within(totals).getAllByText('MVR 150,000.00')).toHaveLength(2);
    expect(within(totals).getByText('USD 1,000.00')).toBeTruthy();
    expect(within(totals).getByText('USD 600.00')).toBeTruthy();
  });

  it('shows the events team deals without any money', async () => {
    renderAs('events', '/deals');
    await screen.findByRole('link', { name: 'Platinum' });
    expect(screen.queryByText(/MVR|USD/)).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Amount' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Totals' })).toBeNull();
  });

  it('creates a deal for a sponsor and event', async () => {
    renderAs('sales', '/deals/new?sponsor_id=sp-sita');
    await screen.findByRole('option', { name: 'Construction Industry Forum 2025' });
    expect((screen.getByLabelText('Sponsor') as HTMLSelectElement).value).toBe('sp-sita');
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'e-cif-2025' } });
    fireEvent.change(screen.getByLabelText('Package'), { target: { value: 'Silver' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2,500' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(writes()[0]).toEqual(expect.objectContaining({ method: 'POST', path: '/deals' })));
    expect(writes()[0].body).toEqual({ sponsor_id: 'sp-sita', edition_id: 'e-cif-2025', package: 'Silver', amount: '2,500', currency: 'USD', status: 'proposed', notes: '' });
    expect(await screen.findByRole('heading', { name: 'SITA · Silver' })).toBeTruthy();
  });
});

describe('Payments', () => {
  it('lets finance record a payment and updates what is outstanding', async () => {
    renderAs('finance', '/deals/d-2');
    expect(await screen.findByText('Outstanding: USD 600.00')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '600' } });
    fireEvent.change(screen.getByLabelText('Date received'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'cheque' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('Outstanding: Paid in full')).toBeTruthy();
    expect(writes()[0]).toEqual({ method: 'POST', path: '/deals/d-2/payments', body: { amount: '600', paid_on: '2026-10-12', method: 'cheque', invoice_no: '', notes: '' } });
  });

  it('shows sales the payments without the record form', async () => {
    renderAs('sales', '/deals/d-2');
    expect(await screen.findByText('INV-001')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
  });

  it('shows an overpayment', async () => {
    renderAs('finance', '/deals/d-2', [{ ...payment, amount: 1050 }]);
    expect(await screen.findByText('Outstanding: Overpaid by USD 50.00')).toBeTruthy();
  });

  it('lets admins delete a payment after confirming', async () => {
    renderAs('admin', '/deals/d-2');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete payment INV-001' }));
    expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete this payment' }));
    expect(await screen.findByText('Outstanding: USD 1,000.00')).toBeTruthy();
    expect(writes()).toEqual([{ method: 'DELETE', path: '/payments/pay-1', body: undefined }]);
  });

  it('hides payments from the events team', async () => {
    renderAs('events', '/deals/d-2');
    expect(await screen.findByRole('heading', { name: 'SITA · Gold' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Payments' })).toBeNull();
    expect(holder.fake.state.calls.some((c) => c.path.endsWith('/payments'))).toBe(false);
  });
});
