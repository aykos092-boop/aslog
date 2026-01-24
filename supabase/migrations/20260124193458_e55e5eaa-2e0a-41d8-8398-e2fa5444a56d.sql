-- ============================================
-- ENTERPRISE AUTH & KYC SYSTEM MIGRATION
-- ============================================

-- 1. OTP CODES TABLE
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('phone_verification', 'email_verification', 'password_reset', 'login')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  telegram_chat_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON public.otp_codes(code);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON public.otp_codes(expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own OTP codes" ON public.otp_codes
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can create OTP codes" ON public.otp_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own OTP codes" ON public.otp_codes
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- 2. TELEGRAM USERS TABLE (for linking Telegram to accounts)
CREATE TABLE IF NOT EXISTS public.telegram_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  phone TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON public.telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_phone ON public.telegram_users(phone);

ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram links" ON public.telegram_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create telegram links" ON public.telegram_users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram links" ON public.telegram_users
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. ENHANCED PROFILES - Add new fields
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS passport_number_hash TEXT,
  ADD COLUMN IF NOT EXISTS passport_series TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS last_ip TEXT,
  ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- 4. ENHANCED KYC DOCUMENTS - Add new fields
ALTER TABLE public.kyc_documents
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS passport_series TEXT,
  ADD COLUMN IF NOT EXISTS passport_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_country TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiry DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS ocr_extracted_name TEXT,
  ADD COLUMN IF NOT EXISTS ocr_extracted_surname TEXT,
  ADD COLUMN IF NOT EXISTS ocr_extracted_dob DATE,
  ADD COLUMN IF NOT EXISTS ocr_extracted_passport_number TEXT,
  ADD COLUMN IF NOT EXISTS ocr_extracted_country TEXT,
  ADD COLUMN IF NOT EXISTS ocr_extracted_expiry DATE,
  ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS ocr_raw_data JSONB,
  ADD COLUMN IF NOT EXISTS data_match_score NUMERIC,
  ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS auto_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 5. PASSWORD RESET TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON public.password_reset_tokens(expires_at);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reset tokens" ON public.password_reset_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can create reset tokens" ON public.password_reset_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own reset tokens" ON public.password_reset_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. USER BALANCE TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('topup', 'charge', 'refund', 'payout', 'bonus', 'admin_adjustment')),
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  admin_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_user ON public.balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_type ON public.balance_transactions(type);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.balance_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON public.balance_transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create transactions" ON public.balance_transactions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

-- 7. SUBSCRIPTION PLANS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC NOT NULL,
  price_yearly NUMERIC,
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.subscription_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default plans
INSERT INTO public.subscription_plans (name, display_name, description, price_monthly, price_yearly, features, limits) VALUES
  ('basic', 'Basic', 'Базовый план для начинающих', 0, 0, '["Создание заказов", "Просмотр статуса"]'::jsonb, '{"orders_per_month": 5}'::jsonb),
  ('pro', 'Pro', 'Профессиональный план', 29.99, 299.99, '["Неограниченные заказы", "Приоритетная поддержка", "API доступ"]'::jsonb, '{"orders_per_month": 100}'::jsonb),
  ('enterprise', 'Enterprise', 'Корпоративный план', 99.99, 999.99, '["Все функции Pro", "Выделенный менеджер", "SLA 99.9%", "White-label"]'::jsonb, '{"orders_per_month": -1}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 8. USER SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  payme_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.user_subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. DEVICE FINGERPRINTS TABLE (for fraud detection)
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  is_vpn BOOLEAN DEFAULT false,
  is_suspicious BOOLEAN DEFAULT false,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user ON public.device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_fingerprint ON public.device_fingerprints(fingerprint);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices" ON public.device_fingerprints
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all devices" ON public.device_fingerprints
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create device records" ON public.device_fingerprints
  FOR INSERT WITH CHECK (true);

-- 10. SECURITY EVENTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security events" ON public.security_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create security events" ON public.security_events
  FOR INSERT WITH CHECK (true);