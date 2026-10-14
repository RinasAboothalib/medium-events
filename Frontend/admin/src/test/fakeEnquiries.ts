// Enquiries for the in-memory test server (see fakeApi.ts).
import { can } from '../lib/permissions';
import type { Enquiry, EnquiryNote, StaffRole } from '../lib/types';
import { NOT_HANDLED } from './fakeEvents';

export type FakeEnquiry = Enquiry & { notes: EnquiryNote[] };

export function makeEnquiry(overrides: Partial<FakeEnquiry> = {}): FakeEnquiry {
  return {
    id: 'q-1',
    created_at: '2026-10-12T04:30:00Z',
    full_name: 'Mariyam Ali',
    company: 'Island Builders',
    email: 'mariyam@islandbuilders.mv',
    phone: '+960 777 1234',
    service: 'Sponsorship or exhibition stand',
    event: 'Construction Industry Forum 2026',
    timeline: 'Within 3 months',
    budget: '',
    message: 'We would like a stand.',
    source: 'website',
    status: 'new',
    assignee_id: null,
    assignee_name: null,
    edition_id: null,
    edition_name: null,
    latest_note: null,
    notes: [],
    ...overrides,
  };
}

type Fail = (status: number, error: string, fields?: Record<string, string>) => never;

export function handleEnquiries(
  state: { enquiries: FakeEnquiry[] },
  me: { id: string; role: StaffRole; full_name: string },
  staffName: (id: string | null) => string | null,
  method: string,
  route: string,
  query: URLSearchParams,
  body: Record<string, unknown> | undefined,
  fail: Fail,
  nextId: () => string,
): unknown {
  const [, area, id, sub] = route.split('/');
  if (area !== 'enquiries') return NOT_HANDLED;
  if (!can(me.role, 'enquiries.access')) fail(403, "You don't have access to this.");
  const view = ({ notes, ...e }: FakeEnquiry): Enquiry => ({ ...e, assignee_name: staffName(e.assignee_id), latest_note: notes[0]?.body ?? null });

  if (method === 'GET' && !id) {
    const q = query.get('q')?.toLowerCase();
    const rows = state.enquiries.filter(
      (e) =>
        (!query.get('status') || e.status === query.get('status')) &&
        (!query.get('source') || e.source === query.get('source')) &&
        (!query.get('assignee') || e.assignee_id === query.get('assignee')) &&
        (!q || [e.full_name, e.company, e.email, e.phone].some((v) => v.toLowerCase().includes(q))),
    );
    const page = Number(query.get('page') ?? 0);
    return { rows: rows.slice(page * 50, page * 50 + 50).map(view), total: rows.length };
  }
  if (method === 'POST' && !id) {
    if (!String(body?.full_name ?? '').trim()) fail(400, 'Check the highlighted fields.', { full_name: "Enter the person's name." });
    const created = makeEnquiry({ ...(body as Partial<Enquiry>), id: nextId(), status: 'new', created_at: '2026-10-13T04:00:00Z' });
    state.enquiries.unshift(created);
    return view(created);
  }
  const found = state.enquiries.find((e) => e.id === id) ?? fail(404, 'That enquiry was not found.');
  if (method === 'GET') return { ...view(found), notes: found.notes };
  if (method === 'PATCH') return view(Object.assign(found, body));
  if (method === 'POST' && sub === 'notes') {
    const note = { id: nextId(), author_name: me.full_name, body: String(body!.body), created_at: '2026-10-13T05:15:00Z' };
    found.notes.unshift(note);
    return note;
  }
  return NOT_HANDLED;
}
