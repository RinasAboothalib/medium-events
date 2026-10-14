// In-memory stand-in for the MEDIUM server's API, used by component tests.
// Mirrors the server's rules closely enough for the UI: sign-in, forced password change, staff, activity,
// plus each section's handlers (fakeEvents, fakeEnquiries, …).
import { ApiError, reportApiError } from '../lib/api';
import type { ActivityRow, Deal, Delegate, Edition, Expense, Payment, ProgrammeSession, Speaker, Sponsor, Partner, PublishInfo, Series, StaffMember, StaffRole, Task } from '../lib/types';
import { NOT_HANDLED, handleEvents } from './fakeEvents';
import { handleEnquiries, type FakeEnquiry } from './fakeEnquiries';
import { handleSales } from './fakeSales';
import { handleOperations } from './fakeOperations';

export interface FakeUser extends Required<Omit<StaffMember, 'last_login_at' | 'created_at'>> {
  password: string;
}

export function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: 'u-admin',
    full_name: 'Aisha Admin',
    email: 'admin@medium.test',
    role: 'admin',
    active: true,
    must_change_password: false,
    password: 'correct-password',
    ...overrides,
  };
}

export function createFakeApi(
  init: {
    users?: FakeUser[];
    signedInAs?: string;
    activity?: ActivityRow[];
    activityTotal?: number;
    series?: Series[];
    editions?: Edition[];
    partners?: Partner[];
    published?: PublishInfo | null;
    enquiries?: FakeEnquiry[];
    sponsors?: Sponsor[];
    deals?: Deal[];
    payments?: Payment[];
    tasks?: Task[];
    speakers?: Speaker[];
    sessions?: ProgrammeSession[];
    delegates?: Delegate[];
    expenses?: Expense[];
    dashboard?: { id: string; label: string; value: string }[];
  } = {},
) {
  const state = {
    users: (init.users ?? []).map((u) => ({ ...u })),
    sessionUserId: init.signedInAs ?? (null as string | null),
    activity: init.activity ?? [],
    activityTotal: init.activityTotal,
    series: (init.series ?? []).map((x) => ({ ...x })),
    editions: (init.editions ?? []).map((x) => ({ ...x })),
    partners: (init.partners ?? []).map((x) => ({ ...x })),
    files: [] as { id: string; filename: string; type: string }[],
    published: init.published ?? null,
    enquiries: (init.enquiries ?? []).map((x) => ({ ...x, notes: [...x.notes] })),
    sponsors: (init.sponsors ?? []).map((x) => ({ ...x })),
    deals: (init.deals ?? []).map((x) => ({ ...x })),
    payments: (init.payments ?? []).map((x) => ({ ...x })),
    tasks: (init.tasks ?? []).map((x) => ({ ...x })),
    speakers: (init.speakers ?? []).map((x) => ({ ...x })),
    sessions: (init.sessions ?? []).map((x) => ({ ...x })),
    delegates: (init.delegates ?? []).map((x) => ({ ...x })),
    expenses: (init.expenses ?? []).map((x) => ({ ...x })),
    dashboard: init.dashboard ?? [],
    calls: [] as { method: string; path: string; body?: unknown }[],
    // Set to make the next matching call fail
    failNext: null as null | { status: number; error: string },
  };
  const me = () => state.users.find((u) => u.id === state.sessionUserId && u.active) ?? null;
  // Errors reach the same listeners as real server errors (the auth provider uses them)
  let ids = 0;
  const nextId = () => `new-${++ids}`;
  const fail = (status: number, error: string, fields?: Record<string, string>): never => {
    const apiError = new ApiError(status, error, fields);
    reportApiError(apiError);
    throw apiError;
  };
  const requireUser = (path: string) => {
    const user = me();
    if (!user) fail(401, 'Sign in to continue.');
    const allowed = ['/auth/me', '/auth/logout', '/auth/change-password'];
    if (user!.must_change_password && !allowed.includes(path)) fail(403, 'password_change_required');
    return user!;
  };
  const publicUser = (u: FakeUser) => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role, must_change_password: u.must_change_password });
  const staffView = (u: FakeUser, details: boolean): StaffMember =>
    details
      ? { id: u.id, email: u.email, full_name: u.full_name, role: u.role, active: u.active, must_change_password: u.must_change_password }
      : { id: u.id, full_name: u.full_name, role: u.role, active: u.active };

  async function handle(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
    state.calls.push({ method, path, body });
    if (state.failNext) {
      const { status, error } = state.failNext;
      state.failNext = null;
      fail(status, error);
    }
    const [route, query = ''] = path.split('?');

    if (method === 'POST' && route === '/auth/login') {
      const user = state.users.find((u) => u.email === String(body?.email).trim().toLowerCase());
      if (!user || user.password !== body?.password || !user.active) fail(401, 'Email or password is incorrect.');
      state.sessionUserId = user!.id;
      return { ok: true };
    }
    const user = requireUser(route);

    if (method === 'GET' && route === '/auth/me') return publicUser(user);
    if (method === 'POST' && route === '/auth/logout') {
      state.sessionUserId = null;
      return undefined;
    }
    if (method === 'POST' && route === '/auth/change-password') {
      if (body?.current_password !== user.password) fail(400, 'Your current password is incorrect.');
      user.password = String(body!.new_password);
      user.must_change_password = false;
      return undefined;
    }
    if (method === 'GET' && route === '/staff') return state.users.map((u) => staffView(u, user.role === 'admin'));
    if (route.startsWith('/staff') && user.role !== 'admin') fail(403, "You don't have access to this.");
    if (method === 'POST' && route === '/staff') {
      const email = String(body!.email).trim().toLowerCase();
      if (state.users.some((u) => u.email === email)) fail(409, 'That email already has an account.');
      const created = makeUser({ id: `u-${state.users.length + 1}`, email, full_name: String(body!.full_name), role: body!.role as StaffRole, must_change_password: true, password: String(body!.temp_password) });
      state.users.push(created);
      return staffView(created, true);
    }
    const staffMatch = route.match(/^\/staff\/([^/]+)(\/reset-password)?$/);
    if (staffMatch) {
      const target = state.users.find((u) => u.id === staffMatch[1]);
      if (!target) fail(404, 'That person was not found.');
      if (staffMatch[2] && method === 'POST') {
        target!.password = String(body!.temp_password);
        target!.must_change_password = true;
        return undefined;
      }
      if (method === 'PATCH') {
        Object.assign(target!, body);
        return staffView(target!, true);
      }
    }
    if (method === 'GET' && route === '/activity') {
      const params = new URLSearchParams(query);
      const rows = user.role === 'admin' ? state.activity : state.activity.filter((r) => r.actor_id === user.id);
      const page = Number(params.get('page') ?? 0);
      return { rows: rows.slice(page * 50, page * 50 + 50), total: state.activityTotal ?? rows.length };
    }
    const events = handleEvents(state, user.role, method, route, new URLSearchParams(query), body, fail, nextId);
    if (events !== NOT_HANDLED) return events;
    const staffName = (id: string | null) => state.users.find((u) => u.id === id)?.full_name ?? null;
    const enquiries = handleEnquiries(state, user, staffName, method, route, new URLSearchParams(query), body, fail, nextId);
    if (enquiries !== NOT_HANDLED) return enquiries;
    const sales = handleSales(state, user, method, route, new URLSearchParams(query), body, fail, nextId);
    if (sales !== NOT_HANDLED) return sales;
    const operations = handleOperations(state, user, staffName, method, route, new URLSearchParams(query), body, fail, nextId);
    if (operations !== NOT_HANDLED) return operations;
    if (method === 'GET' && route === '/dashboard') return { cards: state.dashboard };
    return fail(404, 'Not found.');
  }

  const api = {
    get: (path: string) => handle('GET', path),
    post: (path: string, body?: Record<string, unknown>) => handle('POST', path, body),
    patch: (path: string, body: Record<string, unknown>) => handle('PATCH', path, body),
    del: (path: string) => handle('DELETE', path),
    upload: (path: string, file: Blob) => handle('POST', path, { type: file.type }),
  };
  return { api, state };
}
