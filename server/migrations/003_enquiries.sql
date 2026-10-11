-- Enquiries (leads) from the website form or entered by staff, and the notes staff add to them.

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  service text not null default '',
  event text not null default '',
  timeline text not null default '',
  budget text not null default '',
  message text not null default '',
  source text not null check (source in ('website', 'whatsapp', 'phone', 'email', 'walk_in', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'proposal_sent', 'won', 'lost')),
  assignee_id uuid references users (id) on delete set null,
  edition_id uuid references editions (id) on delete set null
);
create index enquiries_created_idx on enquiries (created_at desc);

create table enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries (id) on delete cascade,
  author_id uuid references users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index enquiry_notes_enquiry_idx on enquiry_notes (enquiry_id, created_at desc);

alter table enquiries enable row level security;
alter table enquiry_notes enable row level security;
