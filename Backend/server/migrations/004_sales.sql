-- Sponsors, sponsorship deals per edition, and the payments received against each deal.
-- A payment's currency is its deal's currency; totals are always grouped by currency.

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sponsors_company_key on sponsors (lower(company));

create table deals (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors (id),
  edition_id uuid not null references editions (id),
  package text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency in ('MVR', 'USD')),
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'cancelled')),
  enquiry_id uuid references enquiries (id) on delete set null,
  notes text not null default '',
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_edition_idx on deals (edition_id);
create index deals_sponsor_idx on deals (sponsor_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null,
  method text not null check (method in ('bank_transfer', 'cash', 'cheque', 'card', 'other')),
  invoice_no text not null default '',
  notes text not null default '',
  recorded_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_deal_idx on payments (deal_id);

alter table sponsors enable row level security;
alter table deals enable row level security;
alter table payments enable row level security;
