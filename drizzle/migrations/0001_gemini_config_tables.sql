CREATE TABLE IF NOT EXISTS public.gemini_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  gemini_api_key_masked text,
  gemini_api_key_encrypted text,
  gemini_api_key_set_at timestamptz,
  gemini_model text NOT NULL DEFAULT 'gemini-2.5-flash-lite-preview-06-17',
  is_active boolean NOT NULL DEFAULT false,
  ai_instructions text NOT NULL DEFAULT 'Voce e a Brenda, atendente virtual da Skina do Frango & Assados no WhatsApp. Responda de forma curta, simpatica e objetiva.',
  daily_limit integer NOT NULL DEFAULT 500,
  daily_used integer NOT NULL DEFAULT 0,
  daily_tokens_used bigint NOT NULL DEFAULT 0,
  daily_tokens_reset_at timestamptz,
  daily_reset_at timestamptz,
  free_tier_only boolean NOT NULL DEFAULT true,
  context_window integer NOT NULL DEFAULT 5,
  last_error text,
  last_used_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gemini_config TO service_role;
GRANT SELECT, UPDATE ON public.gemini_config TO authenticated;
ALTER TABLE public.gemini_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gemini config" ON public.gemini_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.gemini_config (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_phone text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'model')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_msgs_phone_created ON public.conversation_messages(conversation_phone, created_at DESC);
GRANT ALL ON public.conversation_messages TO service_role;
GRANT SELECT ON public.conversation_messages TO authenticated;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read conv messages" ON public.conversation_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_message_id text UNIQUE,
  from_phone text NOT NULL,
  from_name text,
  message_type text NOT NULL DEFAULT 'text',
  message_body text,
  status text NOT NULL DEFAULT 'received',
  gemini_response text,
  gemini_tokens_used integer,
  gemini_model_used text,
  error_message text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
);
GRANT ALL ON public.whatsapp_events TO service_role;
GRANT SELECT ON public.whatsapp_events TO authenticated;
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read wa events" ON public.whatsapp_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';