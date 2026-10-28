-- ==============================================================
-- Gemini Key Storage + Conversation Memory Migration
-- Skina do Frango & Assados — 2026-10-14
-- ==============================================================
-- IMPORTANTE: Execute no SQL Editor do Supabase APÓS a migration anterior.
-- ==============================================================

-- 1. Adicionar coluna para armazenar a chave Gemini criptografada no banco
-- (A chave é armazenada em texto no banco com acesso apenas via service_role)
-- RLS garante que apenas admins autenticados possam ler/editar,
-- mas o conteúdo real nunca é devolvido ao frontend — apenas indicador.
do $$ begin
  alter table public.gemini_config
    add column if not exists gemini_api_key_encrypted text, -- stored server-side only
    add column if not exists gemini_api_key_set_at timestamptz,
    add column if not exists free_tier_only boolean not null default true,
    add column if not exists context_window integer not null default 5,
    add column if not exists daily_tokens_used bigint not null default 0,
    add column if not exists daily_tokens_reset_at timestamptz;
exception when others then null; end $$;

-- 2. Tabela de histórico de conversas individual (mensagens separadas)
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

create policy "service manage conv messages" on public.conversation_messages 
  for all to service_role using (true);

create policy "admin read conv messages" on public.conversation_messages 
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select on public.conversation_messages to authenticated;
grant all on public.conversation_messages to service_role;

-- 3. Tabela de log de eventos do webhook
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

create policy "service manage webhook events" on public.webhook_events 
  for all to service_role using (true);

create policy "admin read webhook events" on public.webhook_events 
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select on public.webhook_events to authenticated;
grant all on public.webhook_events to service_role;

-- 4. Inicializar gemini_config se não existir
insert into public.gemini_config (id) values (true) on conflict do nothing;

-- 5. Garantir que whatsapp_config tem pelo menos uma linha
insert into public.whatsapp_config (id) values (true) on conflict do nothing;
