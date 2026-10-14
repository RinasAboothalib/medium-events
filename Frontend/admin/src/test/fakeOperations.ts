// Tasks, programme, delegates and expenses for the in-memory test server (see fakeApi.ts).
import { can } from '../lib/permissions';
import type { BudgetLine, Deal, Delegate, DelegateStatus, Edition, Expense, Payment, ProgrammeSession, Speaker, StaffRole, Task } from '../lib/types';
import { NOT_HANDLED } from './fakeEvents';

export interface OperationsState {
  tasks: Task[];
  speakers: Speaker[];
  sessions: ProgrammeSession[];
  delegates: Delegate[];
  expenses: Expense[];
  editions: Edition[];
  deals: Deal[];
  payments: Payment[];
}

const EDITION = { edition_id: 'e-cif-2025', edition_name: 'Construction Industry Forum 2025' };

export function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 't-1', ...EDITION, title: 'Book the hall', notes: '', due_date: null, status: 'todo', assignee_id: null, assignee_name: null, completed_at: null, created_at: '2026-10-01T04:00:00Z', ...overrides };
}

export function makeSpeaker(overrides: Partial<Speaker> = {}): Speaker {
  return { id: 'sp-1', edition_id: EDITION.edition_id, full_name: 'Aminath Shauna', job_title: 'Minister', organisation: 'Ministry of Construction', bio: '', sort_order: 0, session_count: 0, ...overrides };
}

export function makeSession(overrides: Partial<ProgrammeSession> = {}): ProgrammeSession {
  return { id: 'ses-1', edition_id: EDITION.edition_id, title: 'Opening keynote', day: '2025-09-02', start_time: '09:00', end_time: '09:45', room: 'Main hall', kind: 'keynote', description: '', speakers: [], ...overrides };
}

export function makeDelegate(overrides: Partial<Delegate> = {}): Delegate {
  return {
    id: 'g-1',
    ...EDITION,
    full_name: 'Mariyam Ali',
    company: 'Island Builders',
    job_title: 'Director',
    email: 'mariyam@islandbuilders.mv',
    phone: '+960 777 1234',
    category: 'delegate',
    status: 'confirmed',
    checked_in_at: null,
    notes: '',
    created_at: '2026-10-01T04:00:00Z',
    ...overrides,
  };
}

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'x-1',
    ...EDITION,
    category: 'venue',
    description: 'Hall hire',
    vendor: 'JEN Malé',
    amount: 45000,
    currency: 'MVR',
    status: 'committed',
    paid_on: null,
    invoice_no: '',
    notes: '',
    created_by_name: 'Fay Finance',
    created_at: '2026-10-01T04:00:00Z',
    ...overrides,
  };
}

type Fail = (status: number, error: string, fields?: Record<string, string>) => never;
const NOW = '2026-10-13T05:00:00.000Z';
const toNumber = (value: unknown) => Number(String(value).replace(/,/g, ''));
const STATUSES: DelegateStatus[] = ['invited', 'registered', 'confirmed', 'attended', 'cancelled', 'no_show'];

export function handleOperations(
  state: OperationsState,
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
  if (!['tasks', 'speakers', 'sessions', 'delegates', 'expenses'].includes(area)) return NOT_HANDLED;
  const guard = (read: Parameters<typeof can>[1], write: Parameters<typeof can>[1]) => can(me.role, method === 'GET' ? read : write) || fail(403, "You don't have access to this.");
  const editionId = query.get('edition_id');
  const inEdition = <T extends { edition_id: string }>(rows: T[]) => rows.filter((r) => !editionId || r.edition_id === editionId);
  const editionName = (eid: unknown) => state.editions.find((e) => e.id === eid)?.name ?? '';

  if (area === 'tasks') {
    guard('tasks.read', 'tasks.write');
    if (method === 'GET' && !id) return inEdition(state.tasks).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
    if (method === 'POST') {
      if (!String(body?.title ?? '').trim()) fail(400, 'Check the highlighted fields.', { title: 'Enter what needs doing.' });
      const created = makeTask({ ...(body as Partial<Task>), id: nextId(), edition_name: editionName(body!.edition_id), assignee_name: staffName((body!.assignee_id as string | null) ?? null) });
      state.tasks.push(created);
      return created;
    }
    const found = state.tasks.find((t) => t.id === id) ?? fail(404, 'That task was not found.');
    if (method === 'PATCH') {
      Object.assign(found, body);
      found.completed_at = found.status === 'done' ? NOW : null;
      found.assignee_name = staffName(found.assignee_id);
      return found;
    }
    if (method === 'DELETE') {
      state.tasks = state.tasks.filter((t) => t !== found);
      return undefined;
    }
  }

  if (area === 'speakers') {
    guard('events.read', 'events.write');
    const view = (sp: Speaker) => ({ ...sp, session_count: state.sessions.filter((s) => s.speakers.some((x) => x.id === sp.id)).length });
    if (method === 'GET') return inEdition(state.speakers).map(view);
    if (method === 'POST') {
      if (!String(body?.full_name ?? '').trim()) fail(400, 'Check the highlighted fields.', { full_name: "Enter the speaker's name." });
      const created = makeSpeaker({ ...(body as Partial<Speaker>), id: nextId() });
      state.speakers.push(created);
      return view(created);
    }
    const found = state.speakers.find((sp) => sp.id === id) ?? fail(404, 'That speaker was not found.');
    if (method === 'PATCH') return view(Object.assign(found, body));
    if (method === 'DELETE') {
      state.speakers = state.speakers.filter((sp) => sp !== found);
      for (const s of state.sessions) s.speakers = s.speakers.filter((x) => x.id !== found.id);
      return undefined;
    }
  }

  if (area === 'sessions') {
    guard('events.read', 'events.write');
    // The server takes speaker_ids and answers with { id, full_name } pairs
    const apply = (session: ProgrammeSession, { speaker_ids, ...rest }: Record<string, unknown>) => {
      Object.assign(session, rest);
      if (speaker_ids) session.speakers = state.speakers.filter((sp) => (speaker_ids as string[]).includes(sp.id)).map((sp) => ({ id: sp.id, full_name: sp.full_name }));
      return session;
    };
    if (method === 'GET') return inEdition(state.sessions).sort((a, b) => `${a.day} ${a.start_time}`.localeCompare(`${b.day} ${b.start_time}`));
    if (method === 'POST') {
      if (!String(body?.title ?? '').trim()) fail(400, 'Check the highlighted fields.', { title: 'Enter the session title.' });
      const created = apply(makeSession({ id: nextId(), speakers: [] }), body!);
      state.sessions.push(created);
      return created;
    }
    const found = state.sessions.find((s) => s.id === id) ?? fail(404, 'That session was not found.');
    if (method === 'PATCH') return apply(found, body!);
    if (method === 'DELETE') {
      state.sessions = state.sessions.filter((s) => s !== found);
      return undefined;
    }
  }

  if (area === 'delegates') {
    guard('delegates.read', 'delegates.write');
    if (method === 'GET' && !id) {
      const all = inEdition(state.delegates);
      const q = query.get('q')?.toLowerCase();
      const rows = all
        .filter(
          (g) =>
            (!query.get('status') || g.status === query.get('status')) &&
            (!query.get('category') || g.category === query.get('category')) &&
            (!q || [g.full_name, g.company, g.email, g.phone].some((v) => v.toLowerCase().includes(q))),
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
      const page = Number(query.get('page') ?? 0);
      const by_status = Object.fromEntries(STATUSES.map((s) => [s, all.filter((g) => g.status === s).length]));
      return { rows: rows.slice(page * 50, page * 50 + 50), total: rows.length, summary: { total: all.length, checked_in: all.filter((g) => g.checked_in_at).length, by_status } };
    }
    if (method === 'POST' && !id) {
      if (!String(body?.full_name ?? '').trim()) fail(400, 'Check the highlighted fields.', { full_name: "Enter the person's name." });
      if (body!.email && state.delegates.some((g) => g.edition_id === body!.edition_id && g.email === body!.email)) {
        fail(409, 'Someone with that email is already registered for this event.', { email: 'Already registered for this event.' });
      }
      const created = makeDelegate({ ...(body as Partial<Delegate>), id: nextId(), edition_name: editionName(body!.edition_id), checked_in_at: null });
      state.delegates.push(created);
      return created;
    }
    const found = state.delegates.find((g) => g.id === id) ?? fail(404, 'That delegate was not found.');
    if (sub === 'check-in') {
      if (method === 'POST') {
        if (found.checked_in_at) fail(409, `${found.full_name} is already checked in.`);
        return Object.assign(found, { status: 'attended', checked_in_at: NOW });
      }
      return Object.assign(found, { status: 'confirmed', checked_in_at: null });
    }
    if (method === 'PATCH') return Object.assign(found, body);
    if (method === 'DELETE') {
      state.delegates = state.delegates.filter((g) => g !== found);
      return undefined;
    }
  }

  if (area === 'expenses') {
    guard('expenses.read', 'expenses.write');
    if (method === 'GET' && id === 'summary') {
      const lines = new Map<string, BudgetLine>();
      const line = (currency: string) => {
        if (!lines.has(currency)) {
          lines.set(currency, { currency: currency as BudgetLine['currency'], income_confirmed: 0, income_received: 0, expenses_planned: 0, expenses_committed: 0, expenses_paid: 0, expenses_total: 0, projected_result: 0, cash_result: 0 });
        }
        return lines.get(currency)!;
      };
      for (const d of inEdition(state.deals).filter((x) => x.status !== 'cancelled')) {
        if (d.status === 'confirmed') line(d.currency!).income_confirmed += d.amount!;
        line(d.currency!).income_received += state.payments.filter((p) => p.deal_id === d.id).reduce((sum, p) => sum + p.amount, 0);
      }
      for (const x of inEdition(state.expenses)) {
        line(x.currency)[`expenses_${x.status}`] += x.amount;
        line(x.currency).expenses_total += x.amount;
      }
      return [...lines.values()]
        .map((l) => ({ ...l, projected_result: l.income_confirmed - l.expenses_total, cash_result: l.income_received - l.expenses_paid }))
        .sort((a, b) => a.currency.localeCompare(b.currency));
    }
    if (method === 'GET' && !id) return inEdition(state.expenses);
    if (method === 'POST') {
      if (!String(body?.description ?? '').trim()) fail(400, 'Check the highlighted fields.', { description: 'Enter what the money is for.' });
      if (body!.status === 'paid' && !body!.paid_on) fail(400, 'Check the highlighted fields.', { paid_on: 'Enter the date it was paid.' });
      const created = makeExpense({ ...(body as Partial<Expense>), id: nextId(), amount: toNumber(body!.amount), edition_name: editionName(body!.edition_id), created_by_name: me.full_name });
      state.expenses.unshift(created);
      return created;
    }
    const found = state.expenses.find((x) => x.id === id) ?? fail(404, 'That expense was not found.');
    if (method === 'GET') return found;
    if (method === 'PATCH') return Object.assign(found, body, body!.amount !== undefined ? { amount: toNumber(body!.amount) } : {});
    if (method === 'DELETE') {
      state.expenses = state.expenses.filter((x) => x !== found);
      return undefined;
    }
  }
  return NOT_HANDLED;
}
