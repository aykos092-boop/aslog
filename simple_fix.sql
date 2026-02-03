-- ПРОСТОЙ ИСПРАВЛЕНИЕ - только самое необходимое

-- Добавляем только нужные колонки в profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS frozen_balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Создаем простую таблицу для AI чата без foreign key
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,  -- Используем TEXT вместо UUID
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Простая политика
CREATE POLICY "Users can view own ai conversations" ON ai_conversations
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::text);

CREATE POLICY "Users can manage own ai conversations" ON ai_conversations
    FOR ALL USING (user_id = current_setting('app.current_user_id')::text);

-- Триггер
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE
    ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Готово!
