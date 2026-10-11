-- Running an edition: the planning checklist, the programme (speakers and sessions),
-- the delegate register with check-in, and the expense budget.

create table tasks (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references editions (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text not null default '',
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  assignee_id uuid references users (id) on delete set null,
  completed_at timestamptz,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_edition_idx on tasks (edition_id, due_date);
create index tasks_assignee_idx on tasks (assignee_id);

create table speakers (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references editions (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  job_title text not null default '',
  organisation text not null default '',
  bio text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index speakers_edition_idx on speakers (edition_id, sort_order);

-- "sessions" is already the sign-in table, so programme sessions carry a prefix.
-- Times are local to the venue, kept as "HH:MM" text so they never shift between time zones
create table programme_sessions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references editions (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  day date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time is null or (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and end_time > start_time)),
  room text not null default '',
  kind text not null default 'presentation'
    check (kind in ('keynote', 'panel', 'presentation', 'workshop', 'ceremony', 'networking', 'break', 'other')),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programme_sessions_edition_idx on programme_sessions (edition_id, day, start_time);

create table programme_session_speakers (
  session_id uuid not null references programme_sessions (id) on delete cascade,
  speaker_id uuid not null references speakers (id) on delete cascade,
  primary key (session_id, speaker_id)
);

-- Delegates hold personal details, so an edition with delegates can't be deleted by accident (no cascade)
create table delegates (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references editions (id),
  full_name text not null check (length(trim(full_name)) > 0),
  company text not null default '',
  job_title text not null default '',
  email text not null default '',
  phone text not null default '',
  category text not null default 'delegate'
    check (category in ('delegate', 'speaker', 'sponsor', 'exhibitor', 'vip', 'media', 'staff')),
  status text not null default 'registered'
    check (status in ('invited', 'registered', 'confirmed', 'attended', 'cancelled', 'no_show')),
  checked_in_at timestamptz,
  notes text not null default '',
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index delegates_edition_idx on delegates (edition_id, lower(full_name));
-- One registration per email address per edition (people without an email are not checked)
create unique index delegates_email_key on delegates (edition_id, lower(email)) where email <> '';

-- What an edition costs. Like deals, totals are always grouped by currency.
create table expenses (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references editions (id),
  category text not null
    check (category in ('venue', 'catering', 'av_production', 'marketing', 'printing', 'travel', 'accommodation', 'staffing', 'speakers', 'decor', 'other')),
  description text not null check (length(trim(description)) > 0),
  vendor text not null default '',
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency in ('MVR', 'USD')),
  status text not null default 'planned' check (status in ('planned', 'committed', 'paid')),
  paid_on date,
  invoice_no text not null default '',
  notes text not null default '',
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'paid' or paid_on is not null)
);
create index expenses_edition_idx on expenses (edition_id);

alter table tasks enable row level security;
alter table speakers enable row level security;
alter table programme_sessions enable row level security;
alter table programme_session_speakers enable row level security;
alter table delegates enable row level security;
alter table expenses enable row level security;
