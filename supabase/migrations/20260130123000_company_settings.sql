-- Настройки компании и платежные системы
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL DEFAULT 'Swift Ship Connect LLC',
    tax_id VARCHAR(50) NOT NULL DEFAULT '123456789',
    bank_name VARCHAR(255) NOT NULL DEFAULT 'TBC Bank',
    account_number VARCHAR(255) NOT NULL DEFAULT '5614681812274623',
    account_holder VARCHAR(255) NOT NULL DEFAULT 'Swift Ship Connect LLC',
    
    -- Click настройки
    click_merchant_id VARCHAR(100) DEFAULT 'swiftship',
    click_service_id INTEGER DEFAULT 1,
    click_secret_key TEXT,
    click_webhook_url VARCHAR(500),
    click_enabled BOOLEAN DEFAULT true,
    
    -- Payme настройки
    payme_merchant_id VARCHAR(100) DEFAULT 'swiftship',
    payme_secret_key TEXT,
    payme_webhook_url VARCHAR(500),
    payme_enabled BOOLEAN DEFAULT true,
    
    -- Uzum Bank настройки
    uzum_merchant_id VARCHAR(100),
    uzum_secret_key TEXT,
    uzum_webhook_url VARCHAR(500),
    uzum_enabled BOOLEAN DEFAULT false,
    
    -- Лимиты и комиссии
    min_deposit_amount BIGINT DEFAULT 10000,
    max_deposit_amount BIGINT DEFAULT 50000000,
    min_withdraw_amount BIGINT DEFAULT 10000,
    max_withdraw_amount BIGINT DEFAULT 10000000,
    withdraw_fee_percent DECIMAL(5,2) DEFAULT 2.00,
    fast_withdraw_fee_percent DECIMAL(5,2) DEFAULT 2.00,
    
    -- Статусы
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вставляем настройки по умолчанию
INSERT INTO company_settings (
    company_name,
    tax_id,
    bank_name,
    account_number,
    account_holder,
    click_merchant_id,
    payme_merchant_id,
    click_webhook_url,
    payme_webhook_url,
    click_secret_key,
    payme_secret_key
) VALUES (
    'Swift Ship Connect LLC',
    '123456789',
    'TBC Bank',
    '5614681812274623',
    'Swift Ship Connect LLC',
    'swiftship',
    'swiftship',
    'https://your-domain.com/api/webhooks/click',
    'https://your-domain.com/api/webhooks/payme',
    'your-click-secret-key',
    'your-payme-secret-key'
) ON CONFLICT DO NOTHING;

-- Таблица для логов платежных операций
CREATE TABLE IF NOT EXISTS payment_logs (
    id SERIAL PRIMARY KEY,
    payment_system VARCHAR(50) NOT NULL, -- click, payme, uzum
    operation_type VARCHAR(50) NOT NULL, -- deposit, withdraw
    transaction_id VARCHAR(255), -- ID транзакции в платежной системе
    user_id UUID REFERENCES auth.users(id),
    amount BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL, -- pending, completed, failed, cancelled
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для привязанных карт пользователей
CREATE TABLE IF NOT EXISTS user_cards (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    card_number_masked VARCHAR(20) NOT NULL, -- 8600****1234
    card_holder VARCHAR(255),
    bank_name VARCHAR(100),
    card_type VARCHAR(50), -- humo, uzcard, visa
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_system ON payment_logs(payment_system);
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_is_active ON user_cards(is_active);

-- RLS политики
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

-- Политики для company_settings (только админы)
CREATE POLICY "Company settings view for admins" ON company_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Company settings update for admins" ON company_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- Политики для payment_logs (админы видят все, пользователи только свои)
CREATE POLICY "Payment logs view for users" ON payment_logs
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- Политики для user_cards (пользователи видят только свои карты)
CREATE POLICY "User cards view for owners" ON user_cards
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "User cards insert for owners" ON user_cards
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "User cards update for owners" ON user_cards
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "User cards delete for owners" ON user_cards
    FOR DELETE USING (user_id = auth.uid());

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE
    ON company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_logs_updated_at BEFORE UPDATE
    ON payment_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_cards_updated_at BEFORE UPDATE
    ON user_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
