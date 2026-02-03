-- ИСПРАВЛЕННЫЙ ПОРЯДОК ВЫПОЛНЕНИЯ SQL
-- Выполнять в этом порядке: 1 -> 2 -> 3

-- ==========================================
-- ШАГ 1: Создание всех таблиц (create_missing_tables.sql)
-- ==========================================

-- Таблица подписок
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    monthly_price BIGINT NOT NULL,
    commission_percent DECIMAL(5,2) NOT NULL,
    features JSONB,
    trial_days INTEGER DEFAULT 0,
    trial_enabled BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица уровней комиссий (ДО добавления колонок!)
CREATE TABLE IF NOT EXISTS commission_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    percent DECIMAL(5,2) NOT NULL,
    min_turnover BIGINT NOT NULL,
    max_turnover BIGINT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица пользовательских подписок
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id VARCHAR(50) REFERENCES subscriptions(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица транзакций
CREATE TABLE IF NOT EXISTS transactions (
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
CREATE TABLE IF NOT EXISTS escrow_operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'frozen' CHECK (status IN ('frozen', 'released', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица доходов платформы
CREATE TABLE IF NOT EXISTS platform_income (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source VARCHAR(50) NOT NULL CHECK (source IN ('commission', 'subscription', 'other')),
    amount BIGINT NOT NULL,
    description TEXT,
    related_user_id UUID REFERENCES auth.users(id),
    related_transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица настроек платформы
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица AI диалогов
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица логов AI чата
CREATE TABLE IF NOT EXISTS ai_chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    response_time_ms INTEGER,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ШАГ 2: Добавление колонок в profiles (ПОСЛЕ создания таблиц)
-- ==========================================

-- Добавляем колонки для подписок и монетизации
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS frozen_balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_commission_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS turnover_30_days BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_level_id UUID REFERENCES commission_levels(id);

-- Добавляем колонку для email_verified если нет
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Добавляем колонку для phone_verified если нет  
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- ==========================================
-- ШАГ 3: Вставка данных и RLS политики
-- ==========================================

-- Вставляем базовые подписки
INSERT INTO subscriptions (id, name, monthly_price, commission_percent, features, trial_days, trial_enabled) VALUES
('basic', 'Basic', 1000000, 5.00, '{"priority_support": false, "fast_withdrawal": false}', 7, true),
('pro', 'Pro', 2000000, 2.00, '{"priority_support": true, "fast_withdrawal": true}', 7, true),
('elite', 'Elite', 5000000, 0.00, '{"priority_support": true, "fast_withdrawal": true, "dedicated_manager": true}', 14, true)
ON CONFLICT (id) DO NOTHING;

-- Вставляем уровни комиссий
INSERT INTO commission_levels (name, percent, min_turnover, max_turnover) VALUES
('Bronze', 4.00, 0, 5000000),
('Silver', 3.00, 5000001, 20000000),
('Gold', 2.00, 20000001, 50000000),
('Platinum', 1.00, 50000001, NULL)
ON CONFLICT DO NOTHING;

-- Вставляем базовые настройки платформы
INSERT INTO platform_settings (key, value, description) VALUES
('global_commission_percent', '3.00', 'Глобальная комиссия платформы'),
('commission_enabled', 'true', 'Включены ли комиссии'),
('auto_trial_enabled', 'true', 'Автоматическое включение trial'),
('default_trial_subscription_id', 'basic', 'Подписка для trial по умолчанию'),
('default_trial_days', '7', 'Дни trial по умолчанию'),
('fast_withdraw_commission', '2.00', 'Комиссия за быстрый вывод'),
('min_withdraw_amount', '10000', 'Минимальная сумма вывода'),
('max_withdraw_amount', '10000000', 'Максимальная сумма вывода')
ON CONFLICT (key) DO NOTHING;

-- Обновляем существующие профили с значениями по умолчанию
UPDATE profiles 
SET 
    balance = COALESCE(balance, 0),
    frozen_balance = COALESCE(frozen_balance, 0),
    trial_used = COALESCE(trial_used, false),
    email_verified = COALESCE(email_verified, false),
    phone_verified = COALESCE(phone_verified, false),
    turnover_30_days = COALESCE(turnover_30_days, 0)
WHERE balance IS NULL 
   OR frozen_balance IS NULL 
   OR trial_used IS NULL 
   OR email_verified IS NULL 
   OR phone_verified IS NULL 
   OR turnover_30_days IS NULL;

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

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_subscriptions_id ON subscriptions(id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscription_id ON user_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_commission_levels_is_active ON commission_levels(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_operations_user_id ON escrow_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_operations_order_id ON escrow_operations(order_id);
CREATE INDEX IF NOT EXISTS idx_platform_income_source ON platform_income(source);
CREATE INDEX IF NOT EXISTS idx_platform_income_created_at ON platform_income(created_at);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_balance ON profiles(balance);
CREATE INDEX IF NOT EXISTS idx_profiles_commission_level_id ON profiles(commission_level_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON ai_conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user_id ON ai_chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_created_at ON ai_chat_logs(created_at);

-- Триггеры для updated_at
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
