ALTER TABLE chatbot_settings ADD COLUMN IF NOT EXISTS openai_api_key TEXT;
ALTER TABLE chatbot_settings ADD COLUMN IF NOT EXISTS openai_model TEXT DEFAULT 'gpt-3.5-turbo';
