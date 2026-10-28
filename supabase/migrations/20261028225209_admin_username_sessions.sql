alter table public.labor_admin_credentials
  add column if not exists username text not null default 'admin'
  constraint labor_admin_username_format check (username ~ '^[a-z0-9._-]{3,40}$');

create table if not exists public.labor_admin_sessions (
  store_id text not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (store_id, token_hash)
);

create index if not exists labor_admin_sessions_expiry
  on public.labor_admin_sessions (expires_at);

alter table public.labor_admin_sessions enable row level security;
revoke all on public.labor_admin_sessions from anon, authenticated;
grant select, insert, update on public.labor_admin_sessions to service_role;
