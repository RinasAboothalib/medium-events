// Sponsors, deals and payments for the in-memory test server (see fakeApi.ts).
import { can } from '../lib/permissions';
import type { Deal, Edition, Payment, Sponsor, StaffRole } from '../lib/types';
import { NOT_HANDLED } from './fakeEvents';

export interface SalesState {
  sponsors: Sponsor[];
  deals: Deal[];
  payments: Payment[];
  editions: Edition[];
}

export function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return { id: 'sp-ooredoo', company: 'Ooredoo Maldives', contact_name: 'Ahmed', email: 'ahmed@ooredoo.mv', phone: '', notes: '', created_at: '2026-10-01T04:00:00Z', deal_count: 0, ...overrides };
}

export function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'd-1',
    sponsor_id: 'sp-ooredoo',
    sponsor_company: 'Ooredoo Maldives',
    edition_id: 'e-cif-2025',
    edition_name: 'Construction Industry Forum 2025',
    package: 'Platinum',
    status: 'confirmed',
    enquiry_id: null,
    created_at: '2026-10-01T04:00:00Z',
    notes: '',
    amount: 150000,
    currency: 'MVR',
    paid: 0,
    outstanding: 150000,
    ...overrides,
  };
}

type Fail = (status: number, error: string, fields?: Record<string, string>) => never;
const MONEY = ['amount', 'currency', 'paid', 'outstanding', 'notes'];
const toNumber = (value: unknown) => Number(String(value).replace(/,/g, ''));

export function handleSales(
  state: SalesState,
  me: { id: string; role: StaffRole; full_name: string },
  method: string,
  route: string,
  query: URLSearchParams,
  body: Record<string, unknown> | undefined,
  fail: Fail,
  nextId: () => string,
): unknown {
  const [, area, id, sub] = route.split('/');
  if (!['sponsors', 'deals', 'payments'].includes(area)) return NOT_HANDLED;
  const guard = (permission: Parameters<typeof can>[1]) => can(me.role, permission) || fail(403, "You don't have access to this.");
  const paidOf = (dealId: string) => state.payments.filter((p) => p.deal_id === dealId).reduce((sum, p) => sum + p.amount, 0);
  const view = (d: Deal): Deal => {
    const paid = paidOf(d.id);
    const full = { ...d, paid, outstanding: (d.amount ?? 0) - paid };
    return can(me.role, 'deals.readAmounts') ? full : (Object.fromEntries(Object.entries(full).filter(([k]) => !MONEY.includes(k))) as unknown as Deal);
  };

  if (area === 'sponsors') {
    if (method === 'GET') guard('sponsors.read');
    else guard('sponsors.write');
    if (method === 'GET' && !id) return state.sponsors.map((s) => ({ ...s, deal_count: state.deals.filter((d) => d.sponsor_id === s.id).length }));
    if (method === 'POST') {
      if (state.sponsors.some((s) => s.company.toLowerCase() === String(body!.company).trim().toLowerCase())) fail(409, 'That sponsor already exists.');
      const created = makeSponsor({ ...(body as Partial<Sponsor>), id: nextId(), deal_count: 0 });
      state.sponsors.push(created);
      return created;
    }
    const found = state.sponsors.find((s) => s.id === id) ?? fail(404, 'That sponsor was not found.');
    if (method === 'GET') return { ...found, deals: state.deals.filter((d) => d.sponsor_id === id).map(view) };
    if (method === 'PATCH') return Object.assign(found, body);
  }

  if (area === 'deals') {
    if (sub === 'payments') {
      const deal = state.deals.find((d) => d.id === id) ?? fail(404, 'That deal was not found.');
      if (method === 'GET') {
        guard('payments.read');
        return state.payments.filter((p) => p.deal_id === id);
      }
      guard('payments.write');
      if (deal.status === 'cancelled') fail(409, 'This deal is cancelled.');
      const payment: Payment = {
        id: nextId(),
        deal_id: id,
        amount: toNumber(body!.amount),
        paid_on: String(body!.paid_on),
        method: body!.method as Payment['method'],
        invoice_no: String(body!.invoice_no ?? ''),
        notes: String(body!.notes ?? ''),
        recorded_by_name: me.full_name,
        created_at: '2026-10-13T05:00:00Z',
      };
      state.payments.push(payment);
      return payment;
    }
    if (method === 'GET') guard('deals.read');
    else guard('deals.write');
    if (method === 'GET' && !id) {
      const rows = state.deals.filter(
        (d) => (!query.get('edition_id') || d.edition_id === query.get('edition_id')) && (!query.get('sponsor_id') || d.sponsor_id === query.get('sponsor_id')) && (!query.get('status') || d.status === query.get('status')),
      );
      if (!can(me.role, 'deals.readAmounts')) return { rows: rows.map(view) };
      const totals = new Map<string, { currency: string; amount: number; paid: number; outstanding: number }>();
      for (const d of rows.filter((r) => r.status !== 'cancelled').map(view)) {
        const t = totals.get(d.currency!) ?? { currency: d.currency!, amount: 0, paid: 0, outstanding: 0 };
        t.amount += d.amount!;
        t.paid += d.paid!;
        t.outstanding += d.outstanding!;
        totals.set(d.currency!, t);
      }
      return { rows: rows.map(view), totals: [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)) };
    }
    if (method === 'POST') {
      const sponsor = state.sponsors.find((s) => s.id === body!.sponsor_id);
      const edition = state.editions.find((e) => e.id === body!.edition_id);
      const created = makeDeal({ ...(body as Partial<Deal>), id: nextId(), amount: toNumber(body!.amount), sponsor_company: sponsor?.company ?? '', edition_name: edition?.name ?? '' });
      state.deals.push(created);
      return view(created);
    }
    const found = state.deals.find((d) => d.id === id) ?? fail(404, 'That deal was not found.');
    if (method === 'GET') return view(found);
    if (method === 'PATCH') return view(Object.assign(found, body, body!.amount !== undefined ? { amount: toNumber(body!.amount) } : {}));
  }

  if (area === 'payments' && method === 'DELETE') {
    guard('payments.delete');
    state.payments = state.payments.filter((p) => p.id !== id);
    return undefined;
  }
  return NOT_HANDLED;
}
