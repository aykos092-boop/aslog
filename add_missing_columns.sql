-- Добавление недостающих колонок в таблицу profiles

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

-- Создаем индексы для новых колонок
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_balance ON profiles(balance);
CREATE INDEX IF NOT EXISTS idx_profiles_commission_level_id ON profiles(commission_level_id);

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
