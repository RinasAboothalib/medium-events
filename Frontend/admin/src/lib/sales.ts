import { api } from './api';
import { attempt } from './result';
import type { Deal, DealStatus, DealTotal, Payment, PaymentMethod, Sponsor } from './types';

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = { proposed: 'Proposed', confirmed: 'Confirmed', cancelled: 'Cancelled' };
export const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

// "MVR 150,000.00"
export const formatMoney = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// What's left to pay, in words: "MVR 600.00", "Paid in full" or "Overpaid by USD 50.00"
export function outstandingText(outstanding: number, currency: string) {
  if (outstanding === 0) return 'Paid in full';
  if (outstanding < 0) return `Overpaid by ${formatMoney(-outstanding, currency)}`;
  return formatMoney(outstanding, currency);
}

export type SponsorInput = Partial<Pick<Sponsor, 'company' | 'contact_name' | 'email' | 'phone' | 'notes'>>;
export type DealInput = Partial<{ sponsor_id: string; edition_id: string; package: string; amount: string; currency: string; status: DealStatus; notes: string }>;
export type PaymentInput = { amount: string; paid_on: string; method: PaymentMethod; invoice_no?: string; notes?: string };

export const listSponsors = () => api.get<Sponsor[]>('/sponsors');
export const getSponsor = (id: string) => api.get<Sponsor & { deals: Deal[] }>(`/sponsors/${id}`);
export const saveSponsor = (id: string | null, input: SponsorInput) =>
  attempt(() => (id ? api.patch<Sponsor>(`/sponsors/${id}`, input) : api.post<Sponsor>('/sponsors', input)), "The sponsor couldn't be saved. Try again.");

export function listDeals(filter: { edition_id?: string; sponsor_id?: string; status?: string }) {
  const params = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
  return api.get<{ rows: Deal[]; totals?: DealTotal[] }>(`/deals?${params}`);
}
export const getDeal = (id: string) => api.get<Deal>(`/deals/${id}`);
export const saveDeal = (id: string | null, input: DealInput) =>
  attempt(() => (id ? api.patch<Deal>(`/deals/${id}`, input) : api.post<Deal>('/deals', input)), "The deal couldn't be saved. Try again.");

export const listPayments = (dealId: string) => api.get<Payment[]>(`/deals/${dealId}/payments`);
export const recordPayment = (dealId: string, input: PaymentInput) =>
  attempt(() => api.post<Payment>(`/deals/${dealId}/payments`, input), "The payment couldn't be saved. Try again.");
export const deletePayment = (id: string) => attempt(() => api.del(`/payments/${id}`), "The payment couldn't be deleted. Try again.");
