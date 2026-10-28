-- ==============================================================
-- Correções e Melhorias — WhatsApp + Gemini Integration
-- Skina do Frango & Assados — 2026-10-15
-- ==============================================================
-- Execute no SQL Editor do Supabase após as migrations anteriores.
-- ==============================================================

-- 1. Garantir que gemini_config tem pelo menos uma linha (idempotente)
insert into public.gemini_config (id) values (true) on conflict do nothing;

-- 2. Garantir que whatsapp_config tem pelo menos uma linha
insert into public.whatsapp_config (id) values (true) on conflict do nothing;

-- 3. Adicionar coluna de tokens diários ao gemini_config (se não existir)
do $$ begin
  alter table public.gemini_config
    add column if not exists gemini_api_key_encrypted text,
    add column if not exists gemini_api_key_set_at timestamptz,
    add column if not exists free_tier_only boolean not null default true,
    add column if not exists context_window integer not null default 5,
    add column if not exists daily_tokens_used bigint not null default 0,
    add column if not exists daily_tokens_reset_at timestamptz;
exception when others then null; end $$;

-- 4. Garantir RLS na gemini_config permita service_role fazer upsert
do $$ begin
  create policy "service manage gemini config" on public.gemini_config
    for all to service_role using (true) with check (true);
exception when others then null; end $$;

-- 5. Garantir RLS na whatsapp_config permita service_role fazer upsert
do $$ begin
  create policy "service manage whatsapp config" on public.whatsapp_config
    for all to service_role using (true) with check (true);
exception when others then null; end $$;

-- 6. Adicionar coluna de raw_payload ao whatsapp_events (se não existir)
do $$ begin
  alter table public.whatsapp_events
    add column if not exists raw_payload jsonb;
exception when others then null; end $$;

-- 7. Conversation messages — garantir que existe e RLS está certo
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_phone text not null,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conv_msgs_phone_created
  on public.conversation_messages(conversation_phone, created_at desc);

alter table public.conversation_messages enable row level security;

do $$ begin
  create policy "service manage conv messages" on public.conversation_messages
    for all to service_role using (true);
exception when others then null; end $$;

do $$ begin
  create policy "admin read conv messages" on public.conversation_messages
    for select to authenticated
    using (public.has_role(auth.uid(), 'admin'));
exception when others then null; end $$;

grant select on public.conversation_messages to authenticated;
grant all on public.conversation_messages to service_role;

-- 8. Webhook events log table
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb,
  status text not null default 'received',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_created
  on public.webhook_events(created_at desc);

alter table public.webhook_events enable row level security;

do $$ begin
  create policy "service manage webhook events" on public.webhook_events
    for all to service_role using (true);
exception when others then null; end $$;

do $$ begin
  create policy "admin read webhook events" on public.webhook_events
    for select to authenticated
    using (public.has_role(auth.uid(), 'admin'));
exception when others then null; end $$;

grant select on public.webhook_events to authenticated;
grant all on public.webhook_events to service_role;
