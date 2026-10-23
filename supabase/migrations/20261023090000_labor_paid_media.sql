-- Additive preparation for a persistent paid-media repository.
-- Does not apply legacy Skina seeds or modify delivery tables.
begin;
create table if not exists public.labor_ads_stores (
 id text primary key, name text not null, created_at timestamptz not null default now()
);
create table if not exists public.labor_ads_members (
 store_id text not null references public.labor_ads_stores(id),
 user_id uuid not null references auth.users(id), role text not null check(role in ('owner','marketing','reader')),
 primary key(store_id,user_id)
);
create or replace function public.labor_ads_can_read(tenant text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.labor_ads_members m where m.store_id=tenant and m.user_id=auth.uid())
$$;
revoke all on function public.labor_ads_can_read(text) from public;
grant execute on function public.labor_ads_can_read(text) to authenticated;
create table if not exists public.labor_ads_drafts (
 id uuid primary key default gen_random_uuid(), store_id text not null references public.labor_ads_stores(id),
 product_id uuid not null, name text not null, objective text not null,
 budget_kind text not null check(budget_kind in ('daily','lifetime')),
 budget_cents bigint not null check(budget_cents>0 and budget_cents<=1000000),
 starts_at timestamptz not null, ends_at timestamptz not null, targeting jsonb not null default '{}',
 state text not null default 'draft' check(state in ('draft','publishing','published','uncertain')),
 account_id text, campaign_id text, adset_id text, creative_id text, ad_id text,
 version integer not null default 1, updated_at timestamptz not null default now(),
 check(ends_at>starts_at), unique(store_id,id)
);
create table if not exists public.labor_ads_metrics (
 store_id text not null references public.labor_ads_stores(id), account_id text not null,
 campaign_id text not null, day date not null, currency text not null check(length(currency)=3),
 spend numeric(16,2) not null check(spend>=0), impressions bigint not null check(impressions>=0),
 reach bigint not null check(reach>=0), clicks bigint not null check(clicks>=0),
 purchases numeric(16,2) not null check(purchases>=0), revenue numeric(16,2) not null check(revenue>=0),
 primary key(store_id,account_id,campaign_id,day)
);
create table if not exists public.labor_ads_events (
 store_id text not null references public.labor_ads_stores(id), event_id uuid not null,
 event_name text not null check(event_name in ('PageView','ViewContent','AddToCart','InitiateCheckout','Purchase')),
 event_at timestamptz not null, visitor_hash text, campaign text, product_id uuid, order_id uuid,
 value_cents bigint check(value_cents>=0), currency text not null default 'BRL',
 consent_at timestamptz not null, dispatched_at timestamptz, dispatch_state text,
 primary key(store_id,event_id), unique(store_id,order_id,event_name)
);
create table if not exists public.labor_ads_jobs (
 store_id text not null references public.labor_ads_stores(id), id uuid not null, resource_id text not null,
 state text not null check(state in ('pending','done','uncertain')), payload_hash text not null,
 created_at timestamptz not null default now(), primary key(store_id,id)
);
create table if not exists public.labor_ads_creatives (
 id uuid primary key default gen_random_uuid(), store_id text not null references public.labor_ads_stores(id),
 product_id uuid not null, created_at timestamptz not null default now(), suggestions jsonb not null default '[]'
);
create table if not exists public.labor_ads_audit (
 id uuid primary key default gen_random_uuid(), store_id text not null references public.labor_ads_stores(id),
 actor uuid references auth.users(id), action text not null, resource_id text not null,
 detail text not null, created_at timestamptz not null default now()
);
-- Browser never receives write access. MFA/role checks must also run in the server repository.
do $$ declare name text; begin
 foreach name in array array['labor_ads_stores','labor_ads_members','labor_ads_drafts','labor_ads_metrics','labor_ads_events','labor_ads_jobs','labor_ads_creatives','labor_ads_audit'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated',name);
  execute format('grant all on public.%I to service_role',name);
 end loop;
 foreach name in array array['labor_ads_drafts','labor_ads_metrics','labor_ads_creatives','labor_ads_audit'] loop
  execute format('grant select on public.%I to authenticated',name);
  execute format('create policy ads_tenant_read on public.%I for select to authenticated using (public.labor_ads_can_read(store_id))',name);
 end loop;
end $$;
create index if not exists labor_ads_metrics_period on public.labor_ads_metrics(store_id,day);
create index if not exists labor_ads_events_period on public.labor_ads_events(store_id,event_at);
create index if not exists labor_ads_jobs_pending on public.labor_ads_jobs(store_id,state,created_at);
commit;
