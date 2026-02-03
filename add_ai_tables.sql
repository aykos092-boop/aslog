-- Создание таблиц для AI чата

-- Таблица для хранения диалогов с AI
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для логирования AI чатов (аналитика)
CREATE TABLE IF NOT EXISTS ai_chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    response_time_ms INTEGER,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_logs ENABLE ROW LEVEL SECURITY;

-- RLS политики для ai_conversations
CREATE POLICY "Users can view own ai conversations" ON ai_conversations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own ai conversations" ON ai_conversations
    FOR ALL USING (user_id = auth.uid());

-- RLS политики для ai_chat_logs
CREATE POLICY "Users can view own ai chat logs" ON ai_chat_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own ai chat logs" ON ai_chat_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ai chat logs" ON ai_chat_logs
    FOR UPDATE USING (user_id = auth.uid());

-- Триггеры для updated_at
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE
    ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON ai_conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user_id ON ai_chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_created_at ON ai_chat_logs(created_at);
