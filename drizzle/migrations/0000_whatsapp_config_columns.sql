alter table public.whatsapp_config
  add column if not exists provider text not null default 'meta',
  add column if not exists phone_number text,
  add column if not exists webhook_verify_token text,
  add column if not exists app_secret_hash text,
  add column if not exists endpoint_url text,
  add column if not exists is_connected boolean not null default false,
  add column if not exists last_tested_at timestamptz,
  add column if not exists last_test_status text,
  add column if not exists last_test_error text;
notify pgrst, 'reload schema';