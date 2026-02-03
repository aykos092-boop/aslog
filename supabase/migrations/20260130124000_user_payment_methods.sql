-- Таблица для сохранения реквизитов пользователей
CREATE TABLE IF NOT EXISTS user_payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    card_number VARCHAR(255) NOT NULL,
    card_holder VARCHAR(255) NOT NULL,
    bank_name VARCHAR(100),
    card_type VARCHAR(50) DEFAULT 'humo', -- humo, uzcard, visa, mastercard
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для контактных данных пользователей
CREATE TABLE IF NOT EXISTS user_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(50),
    telegram_username VARCHAR(100),
    telegram_user_id BIGINT,
    email VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Обновляем таблицы заявок для хранения реквизитов
ALTER TABLE deposit_requests ADD COLUMN payment_method_id UUID REFERENCES user_payment_methods(id);
ALTER TABLE withdraw_requests ADD COLUMN payment_method_id UUID REFERENCES user_payment_methods(id);

-- Добавляем статусы для детального отслеживания
ALTER TABLE deposit_requests ALTER COLUMN status SET DEFAULT 'pending' CHECK (status IN ('pending', 'checking', 'approved', 'rejected'));
ALTER TABLE withdraw_requests ALTER COLUMN status SET DEFAULT 'pending' CHECK (status IN ('pending', 'checking', 'approved', 'rejected', 'processed'));

-- Индексы
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id ON user_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_is_default ON user_payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_is_active ON user_payment_methods(is_active);

CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_is_primary ON user_contacts(is_primary);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_payment_method ON deposit_requests(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_payment_method ON withdraw_requests(payment_method_id);

-- RLS политики
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;

-- Политики для user_payment_methods
CREATE POLICY "Users can view their own payment methods" ON user_payment_methods
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own payment methods" ON user_payment_methods
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own payment methods" ON user_payment_methods
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own payment methods" ON user_payment_methods
    FOR DELETE USING (user_id = auth.uid());

-- Политики для user_contacts
CREATE POLICY "Users can view their own contacts" ON user_contacts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own contacts" ON user_contacts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own contacts" ON user_contacts
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own contacts" ON user_contacts
    FOR DELETE USING (user_id = auth.uid());

-- Политики для админов
CREATE POLICY "Admins can view all payment methods" ON user_payment_methods
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can view all contacts" ON user_contacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- Триггеры для updated_at
CREATE TRIGGER update_user_payment_methods_updated_at BEFORE UPDATE
    ON user_payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_contacts_updated_at BEFORE UPDATE
    ON user_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для получения UID пользователя
CREATE OR REPLACE FUNCTION get_user_uid(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (SELECT raw_user_meta_data->>'uid'::text 
             FROM auth.users 
             WHERE email = user_email),
            'unknown'
        )
    );
END;
$$;

-- Функция для сохранения контактных данных
CREATE OR REPLACE FUNCTION save_user_contact(
    p_user_id UUID,
    p_phone TEXT DEFAULT NULL,
    p_telegram_username TEXT DEFAULT NULL,
    p_telegram_user_id BIGINT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_is_primary BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contact_id UUID;
BEGIN
    -- Если устанавливается как primary, убираем primary у других контактов
    IF p_is_primary THEN
        UPDATE user_contacts 
        SET is_primary = false 
        WHERE user_id = p_user_id;
    END IF;

    -- Вставляем или обновляем контакт
    INSERT INTO user_contacts (
        user_id, phone, telegram_username, telegram_user_id, email, is_primary
    ) VALUES (
        p_user_id, p_phone, p_telegram_username, p_telegram_user_id, p_email, p_is_primary
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        phone = COALESCE(p_phone, user_contacts.phone),
        telegram_username = COALESCE(p_telegram_username, user_contacts.telegram_username),
        telegram_user_id = COALESCE(p_telegram_user_id, user_contacts.telegram_user_id),
        email = COALESCE(p_email, user_contacts.email),
        is_primary = p_is_primary,
        updated_at = NOW()
    RETURNING id INTO v_contact_id;

    RETURN v_contact_id;
END;
$$;
