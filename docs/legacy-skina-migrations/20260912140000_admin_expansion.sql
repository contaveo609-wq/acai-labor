-- ==========================================================
-- Admin Expansion Migration — Skina do Frango & Assados
-- ==========================================================
-- Run this migration in Supabase SQL Editor or via CLI.
-- It adds all tables needed for the expanded admin panel.
-- ==========================================================

-- DELIVERY DRIVERS
create table if not exists public.delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  photo_url text,
  vehicle text,
  plate text,
  status text not null default 'disponivel' check (status in ('disponivel','em_entrega','indisponivel')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.delivery_drivers to authenticated;
grant all on public.delivery_drivers to service_role;
alter table public.delivery_drivers enable row level security;
create policy "admin manage drivers" on public.delivery_drivers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- DRIVER ASSIGNMENTS
create table if not exists public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);
grant select, insert, update on public.driver_assignments to authenticated;
grant all on public.driver_assignments to service_role;
alter table public.driver_assignments enable row level security;
create policy "admin manage assignments" on public.driver_assignments for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ORDER STATUS HISTORY
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  changed_by text,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_osh_order on public.order_status_history(order_id);
grant select, insert on public.order_status_history to authenticated;
grant all on public.order_status_history to service_role;
alter table public.order_status_history enable row level security;
create policy "admin read osh" on public.order_status_history for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- STORE HOURS
create table if not exists public.store_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),
  shift_label text,
  open_time time not null,
  close_time time not null,
  is_active boolean not null default true
);
grant select on public.store_hours to anon, authenticated;
grant insert, update, delete on public.store_hours to authenticated;
grant all on public.store_hours to service_role;
alter table public.store_hours enable row level security;
create policy "public read hours" on public.store_hours for select to anon, authenticated using (true);
create policy "admin manage hours" on public.store_hours for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- COUPONS
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percentual' check (type in ('percentual','valor_fixo')),
  value numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0,
  max_discount numeric(10,2),
  max_uses int,
  uses_per_customer int,
  valid_until timestamptz,
  product_ids uuid[],
  category_ids uuid[],
  is_active boolean not null default true,
  total_uses int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.coupons to anon, authenticated;
grant insert, update, delete on public.coupons to authenticated;
grant all on public.coupons to service_role;
alter table public.coupons enable row level security;
create policy "public read coupons" on public.coupons for select to anon, authenticated using (true);
create policy "admin manage coupons" on public.coupons for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- COUPON USAGES
create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_phone text not null,
  discount_applied numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert on public.coupon_usages to authenticated;
grant all on public.coupon_usages to service_role;
alter table public.coupon_usages enable row level security;
create policy "admin manage coupon_usages" on public.coupon_usages for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- LOYALTY CONFIG
create table if not exists public.loyalty_config (
  id boolean primary key default true check (id),
  points_per_real numeric(6,2) not null default 1,
  points_per_order int not null default 0,
  reward_description text not null default 'R$20 de desconto',
  points_to_redeem int not null default 1000,
  reward_value numeric(10,2) not null default 20,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select on public.loyalty_config to anon, authenticated;
grant update on public.loyalty_config to authenticated;
grant all on public.loyalty_config to service_role;
alter table public.loyalty_config enable row level security;
create policy "public read loyalty" on public.loyalty_config for select to anon, authenticated using (true);
create policy "admin update loyalty" on public.loyalty_config for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.loyalty_config (id) values (true) on conflict do nothing;

-- LOYALTY ACCOUNTS
create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null unique,
  customer_name text not null default '',
  points_balance int not null default 0,
  total_earned int not null default 0,
  total_redeemed int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.loyalty_accounts to authenticated;
grant all on public.loyalty_accounts to service_role;
alter table public.loyalty_accounts enable row level security;
create policy "admin manage loyalty accounts" on public.loyalty_accounts for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- LOYALTY TRANSACTIONS
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  type text not null check (type in ('earn','redeem')),
  points int not null,
  order_id uuid references public.orders(id) on delete set null,
  description text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert on public.loyalty_transactions to authenticated;
grant all on public.loyalty_transactions to service_role;
alter table public.loyalty_transactions enable row level security;
create policy "admin manage loyalty tx" on public.loyalty_transactions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- CAMPAIGNS
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null default '',
  audience text not null default 'todos',
  scheduled_at timestamptz,
  status text not null default 'rascunho' check (status in ('rascunho','agendada','enviando','concluida','cancelada')),
  total_recipients int not null default 0,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "admin manage campaigns" on public.campaigns for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- CAMPAIGN RECIPIENTS
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  customer_phone text not null,
  customer_name text not null default '',
  sent_at timestamptz,
  status text not null default 'pendente' check (status in ('pendente','enviado','falha'))
);
grant select, insert on public.campaign_recipients to authenticated;
grant all on public.campaign_recipients to service_role;
alter table public.campaign_recipients enable row level security;
create policy "admin manage recipients" on public.campaign_recipients for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- REVIEWS (Satisfaction)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  customer_name text not null default '',
  customer_phone text not null default '',
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
grant select, insert on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "admin read reviews" on public.reviews for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "anyone create review" on public.reviews for insert to authenticated
  with check (true);

-- ANALYTICS EVENTS (Funnel)
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);
create index idx_ae_type on public.analytics_events(event_type);
create index idx_ae_created on public.analytics_events(created_at);
grant select on public.analytics_events to authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant all on public.analytics_events to service_role;
alter table public.analytics_events enable row level security;
create policy "anyone insert event" on public.analytics_events for insert to anon, authenticated with check (true);
create policy "admin read events" on public.analytics_events for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- ADMIN ACTIVITY LOGS
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_username text not null,
  action text not null,
  target_type text,
  target_id text,
  details text,
  ip_address text,
  created_at timestamptz not null default now()
);
create index idx_aal_created on public.admin_activity_logs(created_at);
grant select, insert on public.admin_activity_logs to authenticated;
grant all on public.admin_activity_logs to service_role;
alter table public.admin_activity_logs enable row level security;
create policy "admin manage logs" on public.admin_activity_logs for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'info',
  title text not null,
  message text not null default '',
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "admin notifications" on public.notifications for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ADMIN USERS (for RBAC management, not auth)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null default '',
  role text not null default 'OPERADOR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.admin_users to authenticated;
grant all on public.admin_users to service_role;
alter table public.admin_users enable row level security;
create policy "admin manage admin_users" on public.admin_users for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- WHATSAPP CONFIG
create table if not exists public.whatsapp_config (
  id boolean primary key default true check (id),
  access_token text,
  phone_number_id text,
  business_account_id text,
  webhook_url text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select, update on public.whatsapp_config to authenticated;
grant all on public.whatsapp_config to service_role;
alter table public.whatsapp_config enable row level security;
create policy "admin whatsapp config" on public.whatsapp_config for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.whatsapp_config (id) values (true) on conflict do nothing;

-- ADD COLUMNS TO EXISTING TABLES

-- chatbot_settings: add AI config columns
do $$ begin
  alter table public.chatbot_settings add column if not exists ai_provider text default 'lovable';
  alter table public.chatbot_settings add column if not exists ai_model text default 'google/gemini-3.8-flash';
  alter table public.chatbot_settings add column if not exists ai_temperature numeric(3,2) default 0.7;
  alter table public.chatbot_settings add column if not exists system_prompt text default 'Você é Brenda, atendente virtual da Skina do Frango & Assados. Seja objetiva, educada e útil. Utilize somente informações disponíveis no sistema. Nunca invente preços, produtos, horários, promoções ou disponibilidade. Ajude o cliente a escolher produtos e montar seu pedido. Quando não souber alguma informação, encaminhe o cliente para o WhatsApp oficial.';
exception when others then null;
end $$;

-- store_settings: add pause fields
do $$ begin
  alter table public.store_settings add column if not exists pause_reason text;
  alter table public.store_settings add column if not exists paused_at timestamptz;
exception when others then null;
end $$;

-- Seed default admin user record
insert into public.admin_users (username, display_name, role)
values ('admin_teste', 'Administrador', 'ADMIN_MASTER')
on conflict (username) do nothing;
