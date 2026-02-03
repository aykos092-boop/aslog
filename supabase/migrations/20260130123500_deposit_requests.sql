-- Таблица для заявок на пополнение баланса
CREATE TABLE IF NOT EXISTS deposit_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    card_number VARCHAR(255) NOT NULL,
    card_holder VARCHAR(255) NOT NULL,
    description TEXT,
    receipt_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для заявок на вывод средств
CREATE TABLE IF NOT EXISTS withdraw_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    card_number VARCHAR(255) NOT NULL,
    card_holder VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
    admin_notes TEXT,
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_created_at ON deposit_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_withdraw_requests_user_id ON withdraw_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_status ON withdraw_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_created_at ON withdraw_requests(created_at);

-- RLS политики
ALTER TABLE deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdraw_requests ENABLE ROW LEVEL SECURITY;

-- Политики для deposit_requests
CREATE POLICY "Deposit requests view for owners and admins" ON deposit_requests
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Deposit requests insert for users" ON deposit_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Deposit requests update for admins" ON deposit_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- Политики для withdraw_requests
CREATE POLICY "Withdraw requests view for owners and admins" ON withdraw_requests
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Withdraw requests insert for users" ON withdraw_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Withdraw requests update for admins" ON withdraw_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- Триггеры для updated_at
CREATE TRIGGER update_deposit_requests_updated_at BEFORE UPDATE
    ON deposit_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdraw_requests_updated_at BEFORE UPDATE
    ON withdraw_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Создаем бакет для чеков если его нет
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false) 
ON CONFLICT (id) DO NOTHING;

-- RLS политики для storage
CREATE POLICY "Users can upload their own receipts" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'receipts' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can view their own receipts" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Admins can view all receipts" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts' AND 
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );
