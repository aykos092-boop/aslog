-- Create payments table for subscription payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    card_number TEXT NOT NULL, -- Last 4 digits only
    transaction_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    payment_method TEXT DEFAULT 'card',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by TEXT, -- Admin user_id who processed
    notes TEXT
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);

-- Disable RLS for Firebase Auth compatibility
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Create subscription_plans table if not exists
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
    features JSONB, -- JSON array of features
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert basic plans if they don't exist
INSERT INTO public.subscription_plans (name, display_name, description, price_monthly, price_yearly, features) VALUES
('basic', 'Базовый', 'Базовый план для начинающих', 0, 0, '["Создание заказов", "Просмотр статуса"]'::jsonb),
('pro', 'Профи', 'Профессиональный план с расширенными возможностями', 29000, 290000, '["Безлимитные заказы", "Приоритетная поддержка", "Расширенная аналитика", "GPS трекинг", "AI ассистент"]'::jsonb),
('enterprise', 'Enterprise', 'Корпоративный план для бизнеса', 99000, 990000, '["Все возможности Профи", "API доступ", "Персональный менеджер", "Белый лейбл"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create user_subscriptions table for active subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL REFERENCES public.subscription_plans(name),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

-- Disable RLS for Firebase Auth compatibility
ALTER TABLE public.user_subscriptions DISABLE ROW LEVEL SECURITY;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at
CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON public.subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON public.user_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
