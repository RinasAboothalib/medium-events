-- Staff accounts, sign-in sessions and the activity log (spec §3–4).
-- Row-level security is switched on with no policies: Supabase's public API can read nothing,
-- while this server (connected as the database owner) is unaffected.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email)) and email <> ''),
  full_name text not null check (length(trim(full_name)) > 0),
  role text not null check (role in ('admin', 'sales', 'events', 'finance')),
  active boolean not null default true,
  password_hash text not null,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null,
  last_seen_at timestamptz not null,
  expires_at timestamptz not null
);
create index sessions_user_idx on sessions (user_id);

create table activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references users (id) on delete set null,
  entity text not null,
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'delete', 'login', 'publish', 'export')),
  changes jsonb not null default '{}'::jsonb
);
create index activity_log_at_idx on activity_log (at desc);
create index activity_log_actor_idx on activity_log (actor_id);

alter table users enable row level security;
alter table sessions enable row level security;
alter table activity_log enable row level security;
