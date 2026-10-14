import { api } from './api';
import { attempt } from './result';
import type { Enquiry, EnquiryNote, EnquirySource, EnquiryStatus } from './types';

export const PAGE_SIZE = 50;

export const SOURCE_LABELS: Record<EnquirySource, string> = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  email: 'Email',
  walk_in: 'Walk-in',
  other: 'Other',
};

export const STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  proposal_sent: 'Proposal sent',
  won: 'Won',
  lost: 'Lost',
};

export interface EnquiryFilters {
  status?: string;
  source?: string;
  assignee?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
}

export function filterQuery(f: EnquiryFilters) {
  const params = new URLSearchParams();
  for (const key of ['status', 'source', 'assignee', 'q', 'from', 'to'] as const) {
    const value = f[key]?.trim();
    if (value) params.set(key, value);
  }
  if (f.page !== undefined) params.set('page', String(f.page));
  return params.toString();
}

export const listEnquiries = (f: EnquiryFilters) => api.get<{ rows: Enquiry[]; total: number }>(`/enquiries?${filterQuery(f)}`);
export const getEnquiry = (id: string) => api.get<Enquiry & { notes: EnquiryNote[] }>(`/enquiries/${id}`);

export type EnquiryInput = Partial<Omit<Enquiry, 'id' | 'created_at' | 'assignee_name' | 'edition_name' | 'latest_note'>>;

export const saveEnquiry = (id: string | null, input: EnquiryInput) =>
  attempt(() => (id ? api.patch<Enquiry>(`/enquiries/${id}`, input) : api.post<Enquiry>('/enquiries', input)), "The enquiry couldn't be saved. Try again.");
export const addNote = (id: string, body: string) =>
  attempt(() => api.post<EnquiryNote>(`/enquiries/${id}/notes`, { body }), "The note couldn't be saved. Try again.");
