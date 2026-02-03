-- ОЧИСТКА И ИСПРАВЛЕНИЕ БАЗЫ ДАННЫХ
-- Сначала удаляем старые данные, потом создаем новые таблицы

-- ==========================================
-- ШАГ 1: Удаление старых данных и таблиц
-- ==========================================

-- Удаляем все таблицы если они существуют
DROP TABLE IF EXISTS ai_chat_logs CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS platform_income CASCADE;
DROP TABLE IF EXISTS escrow_operations CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS commission_levels CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Удаляем колонки из profiles если они существуют
ALTER TABLE profiles 
DROP COLUMN IF EXISTS subscription_id,
DROP COLUMN IF EXISTS subscription_expires_at,
DROP COLUMN IF EXISTS trial_used,
DROP COLUMN IF EXISTS balance,
DROP COLUMN IF EXISTS frozen_balance,
DROP COLUMN IF EXISTS custom_commission_percent,
DROP COLUMN IF EXISTS turnover_30_days,
DROP COLUMN IF EXISTS commission_level_id,
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS phone_verified;

-- ==========================================
-- ШАГ 2: Создание новых таблиц с правильными типами
-- ==========================================

-- Таблица подписок с UUID ID
CREATE TABLE subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    monthly_price BIGINT NOT NULL,
    commission_percent NUMERIC(5,2) NOT NULL,
    features JSONB,
    trial_days INTEGER DEFAULT 0,
    trial_enabled BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица уровней комиссий
CREATE TABLE commission_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    percent NUMERIC(5,2) NOT NULL,
    min_turnover BIGINT NOT NULL,
    max_turnover BIGINT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица пользовательских подписок
CREATE TABLE user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица транзакций
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'withdraw', 'commission', 'escrow_freeze', 'escrow_release')),
    amount BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица escrow операций
CREATE TABLE escrow_operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'frozen' CHECK (status IN ('frozen', 'released', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица доходов платформы
CREATE TABLE platform_income (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source VARCHAR(50) NOT NULL CHECK (source IN ('commission', 'subscription', 'other')),
    amount BIGINT NOT NULL,
    description TEXT,
    related_user_id UUID REFERENCES auth.users(id),
    related_transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица настроек платформы
CREATE TABLE platform_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица AI диалогов
CREATE TABLE ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица логов AI чата
CREATE TABLE ai_chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    response_time_ms INTEGER,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ШАГ 3: Добавление колонок в profiles
-- ==========================================

ALTER TABLE profiles 
ADD COLUMN subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN trial_used BOOLEAN DEFAULT false,
ADD COLUMN balance BIGINT DEFAULT 0,
ADD COLUMN frozen_balance BIGINT DEFAULT 0,
ADD COLUMN custom_commission_percent NUMERIC(5,2),
ADD COLUMN turnover_30_days BIGINT DEFAULT 0,
ADD COLUMN commission_level_id UUID REFERENCES commission_levels(id),
ADD COLUMN email_verified BOOLEAN DEFAULT false,
ADD COLUMN phone_verified BOOLEAN DEFAULT false;

-- ==========================================
-- ШАГ 4: Вставка базовых данных
-- ==========================================

-- Вставляем подписки с UUID
INSERT INTO subscriptions (id, name, monthly_price, commission_percent, features, trial_days, trial_enabled) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Basic', 1000000, 5.00, '{"priority_support": false, "fast_withdrawal": false}', 7, true),
('550e8400-e29b-41d4-a716-446655440002', 'Pro', 2000000, 2.00, '{"priority_support": true, "fast_withdrawal": true}', 7, true),
('550e8400-e29b-41d4-a716-446655440003', 'Elite', 5000000, 0.00, '{"priority_support": true, "fast_withdrawal": true, "dedicated_manager": true}', 14, true);

-- Вставляем уровни комиссий
INSERT INTO commission_levels (name, percent, min_turnover, max_turnover) VALUES
('Bronze', 4.00, 0, 5000000),
('Silver', 3.00, 5000001, 20000000),
('Gold', 2.00, 20000001, 50000000),
('Platinum', 1.00, 50000001, NULL);

-- Вставляем настройки платформы
INSERT INTO platform_settings (key, value, description) VALUES
('global_commission_percent', '3.00', 'Глобальная комиссия платформы'),
('commission_enabled', 'true', 'Включены ли комиссии'),
('auto_trial_enabled', 'true', 'Автоматическое включение trial'),
('default_trial_subscription_id', '550e8400-e29b-41d4-a716-446655440001', 'Подписка для trial по умолчанию'),
('default_trial_days', '7', 'Дни trial по умолчанию'),
('fast_withdraw_commission', '2.00', 'Комиссия за быстрый вывод'),
('min_withdraw_amount', '10000', 'Минимальная сумма вывода'),
('max_withdraw_amount', '10000000', 'Максимальная сумма вывода');

-- ==========================================
-- ШАГ 5: Включение RLS и политики
-- ==========================================

-- Включаем RLS для всех таблиц
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_logs ENABLE ROW LEVEL SECURITY;

-- RLS политики
CREATE POLICY "Public read access for subscriptions" ON subscriptions
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own subscriptions" ON user_subscriptions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Public read access for commission levels" ON commission_levels
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own transactions" ON transactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own transactions" ON transactions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own escrow operations" ON escrow_operations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all platform income" ON platform_income
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Public read access for platform settings" ON platform_settings
    FOR SELECT USING (true);

CREATE POLICY "Users can view own ai conversations" ON ai_conversations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own ai conversations" ON ai_conversations
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own ai chat logs" ON ai_chat_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own ai chat logs" ON ai_chat_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ai chat logs" ON ai_chat_logs
    FOR UPDATE USING (user_id = auth.uid());

-- ==========================================
-- ШАГ 6: Создание индексов
-- ==========================================

CREATE INDEX idx_subscriptions_id ON subscriptions(id);
CREATE INDEX idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_subscription_id ON user_subscriptions(subscription_id);
CREATE INDEX idx_commission_levels_is_active ON commission_levels(is_active);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_escrow_operations_user_id ON escrow_operations(user_id);
CREATE INDEX idx_escrow_operations_order_id ON escrow_operations(order_id);
CREATE INDEX idx_platform_income_source ON platform_income(source);
CREATE INDEX idx_platform_income_created_at ON platform_income(created_at);
CREATE INDEX idx_platform_settings_key ON platform_settings(key);
CREATE INDEX idx_profiles_subscription_id ON profiles(subscription_id);
CREATE INDEX idx_profiles_balance ON profiles(balance);
CREATE INDEX idx_profiles_commission_level_id ON profiles(commission_level_id);
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_updated_at ON ai_conversations(updated_at);
CREATE INDEX idx_ai_chat_logs_user_id ON ai_chat_logs(user_id);
CREATE INDEX idx_ai_chat_logs_created_at ON ai_chat_logs(created_at);

-- ==========================================
-- ШАГ 7: Триггеры для updated_at
-- ==========================================

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE
    ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE
    ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_levels_updated_at BEFORE UPDATE
    ON commission_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE
    ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_operations_updated_at BEFORE UPDATE
    ON escrow_operations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE
    ON platform_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE
    ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- ШАГ 8: Проверка результата
-- ==========================================

-- Показываем что все создано правильно
SELECT 
    'subscriptions' as table_name,
    COUNT(*) as row_count,
    pg_typeof(id) as id_type
FROM subscriptions
UNION ALL
SELECT 
    'user_subscriptions' as table_name,
    COUNT(*) as row_count,
    pg_typeof(subscription_id) as id_type
FROM user_subscriptions
UNION ALL
SELECT 
    'profiles' as table_name,
    COUNT(*) as row_count,
    pg_typeof(subscription_id) as id_type
FROM profiles
WHERE subscription_id IS NOT NULL;

-- Показываем подписки
SELECT id, name, monthly_price, commission_percent FROM subscriptions;
