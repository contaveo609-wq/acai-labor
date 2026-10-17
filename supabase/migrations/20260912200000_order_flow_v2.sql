-- ==========================================================
-- Order Flow V2 Migration — Skina do Frango & Assados
-- ==========================================================

-- 1. ADD 'pronto' TO order_status ENUM
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pronto' AFTER 'em_preparacao';

-- 2. ADD FIELDS TO delivery_drivers
ALTER TABLE public.delivery_drivers ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.delivery_drivers ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE public.delivery_drivers ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

-- 3. CREATE ia_unresolved_queries TABLE
CREATE TABLE IF NOT EXISTS public.ia_unresolved_queries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default '',
  customer_phone text not null,
  user_message text not null,
  bot_response text not null,
  status text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_unresolved_queries TO authenticated;
GRANT ALL ON public.ia_unresolved_queries TO service_role;
ALTER TABLE public.ia_unresolved_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage ia_unresolved_queries" ON public.ia_unresolved_queries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. CREATE whatsapp_provider_config TABLE
CREATE TABLE IF NOT EXISTS public.whatsapp_provider_config (
  id boolean primary key default true check (id),
  provider_name text not null default 'meta_official',
  endpoint text,
  api_token text,
  webhook_url text,
  phone_number text,
  is_connected boolean not null default false,
  last_tested_at timestamptz,
  updated_at timestamptz not null default now()
);
GRANT SELECT, UPDATE ON public.whatsapp_provider_config TO authenticated;
GRANT ALL ON public.whatsapp_provider_config TO service_role;
ALTER TABLE public.whatsapp_provider_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin whatsapp provider config" ON public.whatsapp_provider_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.whatsapp_provider_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 5. REALTIME ENABLEMENT
-- Ensure the tables are in the realtime publication
DO $$
BEGIN
  -- orders
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  -- notifications
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  -- delivery_drivers
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_drivers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;
  END IF;
  -- driver_assignments
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'driver_assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_assignments;
  END IF;
  -- ia_unresolved_queries
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ia_unresolved_queries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ia_unresolved_queries;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if publication doesn't exist locally or if already added
  NULL;
END $$;

-- 6. NEW ORDER TRIGGER FOR NOTIFICATIONS & HISTORY
CREATE OR REPLACE FUNCTION public.handle_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert status history
  INSERT INTO public.order_status_history (order_id, status, notes)
  VALUES (NEW.id, NEW.status, 'Pedido recebido pelo sistema.');
  
  -- Create notification
  INSERT INTO public.notifications (type, title, message, link)
  VALUES (
    'novo_pedido',
    'Novo Pedido #' || NEW.order_number,
    'Cliente: ' || NEW.customer_name || ' | Total: R$ ' || NEW.total,
    '/admin/pedidos?id=' || NEW.id
  );
  
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_new_order_created ON public.orders;
CREATE TRIGGER on_new_order_created 
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_order();
