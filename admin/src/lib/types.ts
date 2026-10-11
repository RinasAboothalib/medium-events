// Shapes returned by the MEDIUM server (server/src).

export type StaffRole = 'admin' | 'sales' | 'events' | 'finance';

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  sales: 'Sales',
  events: 'Events',
  finance: 'Finance',
};

// GET /api/auth/me
export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  must_change_password: boolean;
}

// GET /api/staff — admins get every field, others id/full_name/role/active
export interface StaffMember {
  id: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  email?: string;
  must_change_password?: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

export interface ActivityRow {
  id: number;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  entity: string;
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'publish' | 'export';
  changes: Record<string, unknown>;
}

// ---- events (server/src/events/routes.ts) ----
export interface Series {
  id: string;
  slug: string;
  name: string;
  label: string;
  short_name: string;
  tagline: string;
  description: string[];
  website: string | null;
  endorsement: string | null;
  audience: string;
  usual_venue: string;
  usual_month: string;
  cta_secondary: string | null;
  sort_order: number;
  active: boolean;
  edition_count: number;
}

export type EditionStatus = 'upcoming' | 'past' | 'cancelled';

export interface Edition {
  id: string;
  series_id: string;
  series_name: string;
  name: string;
  start_date: string;
  end_date: string | null;
  venue: string;
  description: string;
  rsvp_count: number | null;
  attendance: number | null;
  facebook_url: string | null;
  banner_file_id: string | null;
  status: EditionStatus;
  outcome_notes: string;
}

export interface Partner {
  id: string;
  name: string;
  role: string;
  series_id: string | null;
  edition_id: string | null;
  sort_order: number;
}

export interface PublishInfo {
  published_at: string;
  published_by_name: string | null;
  series: number;
  events: number;
}

// ---- enquiries (server/src/enquiries/routes.ts) ----
export type EnquirySource = 'website' | 'whatsapp' | 'phone' | 'email' | 'walk_in' | 'other';
export type EnquiryStatus = 'new' | 'contacted' | 'proposal_sent' | 'won' | 'lost';

export interface Enquiry {
  id: string;
  created_at: string;
  full_name: string;
  company: string;
  email: string;
  phone: string;
  service: string;
  event: string;
  timeline: string;
  budget: string;
  message: string;
  source: EnquirySource;
  status: EnquiryStatus;
  assignee_id: string | null;
  assignee_name: string | null;
  edition_id: string | null;
  edition_name: string | null;
  latest_note: string | null;
}

export interface EnquiryNote {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

// ---- sponsors, deals, payments (server/src/sales/routes.ts) ----
export type Currency = 'MVR' | 'USD';
export type DealStatus = 'proposed' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'other';

export interface Sponsor {
  id: string;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
  created_at: string;
  deal_count: number;
}

// Money fields are left out for roles that can't see amounts (events)
export interface Deal {
  id: string;
  sponsor_id: string;
  sponsor_company: string;
  edition_id: string;
  edition_name: string;
  package: string;
  status: DealStatus;
  enquiry_id: string | null;
  created_at: string;
  notes?: string;
  amount?: number;
  currency?: Currency;
  paid?: number;
  outstanding?: number;
}

export interface DealTotal {
  currency: Currency;
  amount: number;
  paid: number;
  outstanding: number;
}

export interface Payment {
  id: string;
  deal_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  invoice_no: string;
  notes: string;
  recorded_by_name: string | null;
  created_at: string;
}

// ---- running an edition: tasks, programme, delegates, expenses (server/src/{tasks,programme,delegates,expenses}) ----
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  edition_id: string;
  edition_name: string;
  title: string;
  notes: string;
  due_date: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  assignee_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Speaker {
  id: string;
  edition_id: string;
  full_name: string;
  job_title: string;
  organisation: string;
  bio: string;
  sort_order: number;
  session_count: number;
}

export type SessionKind = 'keynote' | 'panel' | 'presentation' | 'workshop' | 'ceremony' | 'networking' | 'break' | 'other';

export interface ProgrammeSession {
  id: string;
  edition_id: string;
  title: string;
  day: string;
  start_time: string;
  end_time: string | null;
  room: string;
  kind: SessionKind;
  description: string;
  speakers: { id: string; full_name: string }[];
}

export type DelegateCategory = 'delegate' | 'speaker' | 'sponsor' | 'exhibitor' | 'vip' | 'media' | 'staff';
export type DelegateStatus = 'invited' | 'registered' | 'confirmed' | 'attended' | 'cancelled' | 'no_show';

export interface Delegate {
  id: string;
  edition_id: string;
  edition_name: string;
  full_name: string;
  company: string;
  job_title: string;
  email: string;
  phone: string;
  category: DelegateCategory;
  status: DelegateStatus;
  checked_in_at: string | null;
  notes: string;
  created_at: string;
}

export interface DelegateSummary {
  total: number;
  checked_in: number;
  by_status: Record<DelegateStatus, number>;
}

export type ExpenseCategory = 'venue' | 'catering' | 'av_production' | 'marketing' | 'printing' | 'travel' | 'accommodation' | 'staffing' | 'speakers' | 'decor' | 'other';
export type ExpenseStatus = 'planned' | 'committed' | 'paid';

export interface Expense {
  id: string;
  edition_id: string;
  edition_name: string;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  currency: Currency;
  status: ExpenseStatus;
  paid_on: string | null;
  invoice_no: string;
  notes: string;
  created_by_name: string | null;
  created_at: string;
}

// GET /api/expenses/summary: one line per currency
export interface BudgetLine {
  currency: Currency;
  income_confirmed: number;
  income_received: number;
  expenses_planned: number;
  expenses_committed: number;
  expenses_paid: number;
  expenses_total: number;
  projected_result: number;
  cash_result: number;
}
