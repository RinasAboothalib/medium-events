// Running an edition: its checklist, programme, delegate register and budget.
import { api } from './api';
import { attempt } from './result';
import type {
  BudgetLine,
  Delegate,
  DelegateCategory,
  DelegateStatus,
  DelegateSummary,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  ProgrammeSession,
  SessionKind,
  Speaker,
  Task,
  TaskStatus,
} from './types';

// Only the filters that are set
const query = (filters: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

// ---- tasks ----
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
export type TaskInput = Partial<Pick<Task, 'title' | 'notes' | 'due_date' | 'status' | 'assignee_id'>> & { edition_id?: string };

export const listTasks = (editionId: string) => api.get<Task[]>(`/tasks?${query({ edition_id: editionId })}`);
export const saveTask = (id: string | null, input: TaskInput) =>
  attempt(() => (id ? api.patch<Task>(`/tasks/${id}`, input) : api.post<Task>('/tasks', input)), "The task couldn't be saved. Try again.");
export const deleteTask = (id: string) => attempt(() => api.del(`/tasks/${id}`), "The task couldn't be removed. Try again.");

// ---- programme ----
export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  keynote: 'Keynote',
  panel: 'Panel',
  presentation: 'Presentation',
  workshop: 'Workshop',
  ceremony: 'Ceremony',
  networking: 'Networking',
  break: 'Break',
  other: 'Other',
};
export type SpeakerInput = Partial<Pick<Speaker, 'full_name' | 'job_title' | 'organisation' | 'bio' | 'sort_order'>> & { edition_id?: string };
export type SessionInput = Partial<Pick<ProgrammeSession, 'title' | 'day' | 'start_time' | 'end_time' | 'room' | 'kind' | 'description'>> & {
  edition_id?: string;
  speaker_ids?: string[];
};

export const listSpeakers = (editionId: string) => api.get<Speaker[]>(`/speakers?${query({ edition_id: editionId })}`);
export const saveSpeaker = (id: string | null, input: SpeakerInput) =>
  attempt(() => (id ? api.patch<Speaker>(`/speakers/${id}`, input) : api.post<Speaker>('/speakers', input)), "The speaker couldn't be saved. Try again.");
export const deleteSpeaker = (id: string) => attempt(() => api.del(`/speakers/${id}`), "The speaker couldn't be removed. Try again.");

export const listSessions = (editionId: string) => api.get<ProgrammeSession[]>(`/sessions?${query({ edition_id: editionId })}`);
export const saveSession = (id: string | null, input: SessionInput) =>
  attempt(
    () => (id ? api.patch<ProgrammeSession>(`/sessions/${id}`, input) : api.post<ProgrammeSession>('/sessions', input)),
    "The session couldn't be saved. Try again.",
  );
export const deleteSession = (id: string) => attempt(() => api.del(`/sessions/${id}`), "The session couldn't be removed. Try again.");

// ---- delegates ----
// Matches server/src/delegates/routes.ts
export const DELEGATE_PAGE_SIZE = 50;
export const DELEGATE_CATEGORY_LABELS: Record<DelegateCategory, string> = {
  delegate: 'Delegate',
  speaker: 'Speaker',
  sponsor: 'Sponsor',
  exhibitor: 'Exhibitor',
  vip: 'VIP',
  media: 'Media',
  staff: 'Staff',
};
export const DELEGATE_STATUS_LABELS: Record<DelegateStatus, string> = {
  invited: 'Invited',
  registered: 'Registered',
  confirmed: 'Confirmed',
  attended: 'Attended',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
export type DelegateInput = Partial<Pick<Delegate, 'full_name' | 'company' | 'job_title' | 'email' | 'phone' | 'category' | 'status' | 'notes'>> & { edition_id?: string };
export interface DelegateFilters {
  status?: string;
  category?: string;
  q?: string;
  page: number;
}

export const listDelegates = (editionId: string, f: DelegateFilters) =>
  api.get<{ rows: Delegate[]; total: number; summary: DelegateSummary }>(`/delegates?${query({ edition_id: editionId, ...f, q: f.q?.trim() })}`);
export const saveDelegate = (id: string | null, input: DelegateInput) =>
  attempt(() => (id ? api.patch<Delegate>(`/delegates/${id}`, input) : api.post<Delegate>('/delegates', input)), "The delegate couldn't be saved. Try again.");
export const deleteDelegate = (id: string) => attempt(() => api.del(`/delegates/${id}`), "The delegate couldn't be removed. Try again.");
export const checkIn = (id: string) => attempt(() => api.post<Delegate>(`/delegates/${id}/check-in`), "The check-in couldn't be saved. Try again.");
export const undoCheckIn = (id: string) => attempt(() => api.del<Delegate>(`/delegates/${id}/check-in`), "The check-in couldn't be undone. Try again.");

// ---- expenses ----
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  venue: 'Venue',
  catering: 'Catering',
  av_production: 'AV and production',
  marketing: 'Marketing',
  printing: 'Printing',
  travel: 'Travel',
  accommodation: 'Accommodation',
  staffing: 'Staffing',
  speakers: 'Speakers',
  decor: 'Decor',
  other: 'Other',
};
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = { planned: 'Planned', committed: 'Committed', paid: 'Paid' };
// Amounts are typed as text ("45,000") and checked by the server
export type ExpenseInput = Partial<Pick<Expense, 'category' | 'description' | 'vendor' | 'currency' | 'status' | 'paid_on' | 'invoice_no' | 'notes'>> & {
  edition_id?: string;
  amount?: string;
};

export const listExpenses = (editionId: string) => api.get<Expense[]>(`/expenses?${query({ edition_id: editionId })}`);
export const budgetSummary = (editionId: string) => api.get<BudgetLine[]>(`/expenses/summary?${query({ edition_id: editionId })}`);
export const saveExpense = (id: string | null, input: ExpenseInput) =>
  attempt(() => (id ? api.patch<Expense>(`/expenses/${id}`, input) : api.post<Expense>('/expenses', input)), "The expense couldn't be saved. Try again.");
export const deleteExpense = (id: string) => attempt(() => api.del(`/expenses/${id}`), "The expense couldn't be removed. Try again.");
