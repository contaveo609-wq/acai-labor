-- Açaí Labor server-side persistence. No browser role may read these tables.
create table if not exists public.labor_state (
  store_id text primary key,
  version bigint not null default 0 check (version >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.labor_admin_credentials (
  store_id text primary key,
  salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.labor_secrets (
  store_id text not null,
  purpose text not null,
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (store_id, purpose)
);

alter table public.labor_state enable row level security;
alter table public.labor_admin_credentials enable row level security;
alter table public.labor_secrets enable row level security;

revoke all on public.labor_state from anon, authenticated;
revoke all on public.labor_admin_credentials from anon, authenticated;
revoke all on public.labor_secrets from anon, authenticated;
grant select, insert, update on public.labor_state to service_role;
grant select, insert on public.labor_admin_credentials to service_role;
grant select, insert, update on public.labor_secrets to service_role;
