-- Event management: uploaded images, event series, their editions, partners, and published website snapshots.

create table files (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size integer not null check (size > 0 and size <= 5242880),
  data bytea not null,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table event_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  -- Short grouping name the website shows on edition cards, e.g. "Aviation Forum"
  label text not null,
  short_name text not null,
  tagline text not null default '',
  description text[] not null default '{}',
  website text,
  endorsement text,
  audience text not null default '',
  usual_venue text not null default '',
  usual_month text not null default '',
  cta_secondary text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table editions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references event_series (id),
  name text not null,
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  venue text not null default '',
  description text not null default '',
  rsvp_count integer check (rsvp_count is null or rsvp_count >= 0),
  attendance integer check (attendance is null or attendance >= 0),
  facebook_url text,
  banner_file_id uuid references files (id),
  status text not null default 'upcoming' check (status in ('upcoming', 'past', 'cancelled')),
  outcome_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index editions_series_idx on editions (series_id, start_date desc);

create table partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '',
  series_id uuid references event_series (id) on delete cascade,
  edition_id uuid references editions (id) on delete cascade,
  sort_order integer not null default 0,
  check (series_id is not null or edition_id is not null)
);

create table published_snapshots (
  id bigint generated always as identity primary key,
  published_at timestamptz not null default now(),
  published_by uuid references users (id) on delete set null,
  data jsonb not null
);

alter table files enable row level security;
alter table event_series enable row level security;
alter table editions enable row level security;
alter table partners enable row level security;
alter table published_snapshots enable row level security;
