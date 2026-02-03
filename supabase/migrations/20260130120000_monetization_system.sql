-- =============================================
-- MONETIZATION SYSTEM MIGRATION
-- =============================================

-- =============================================
-- 1. NEW ENUMS
-- =============================================

-- Transaction types
CREATE TYPE public.transaction_type AS ENUM (
  'deposit', 
  'withdraw', 
  'freeze', 
  'release', 
  'commission', 
  'subscription_payment', 
  'promotion', 
  'fast_withdraw',
  'refund',
  'bonus'
);

-- Transaction status
CREATE TYPE public.transaction_status AS ENUM ('pending', 'confirmed', 'rejected', 'failed');

-- Document types
CREATE TYPE public.document_type AS ENUM (
  -- Order documents
  'transport_contract',
  'waybill',
  'completion_act',
  'invoice',
  'cmr',
  -- Driver documents
  'passport',
  'drivers_license',
  'vehicle_registration',
  'insurance',
  'license',
  'adr'
);

-- Document status
CREATE TYPE public.document_status AS ENUM ('uploaded', 'verified', 'rejected', 'expired');

-- Platform income sources
CREATE TYPE public.income_source AS ENUM (
  'commission',
  'subscription',
  'promotion',
  'fast_withdraw',
  'insurance',
  'b2b',
  'document_fee'
);

-- =============================================
-- 2. UPDATE PROFILES TABLE WITH WALLET FIELDS
-- =============================================

ALTER TABLE public.profiles 
ADD COLUMN balance DECIMAL(15, 2) DEFAULT 0.00,
ADD COLUMN frozen_balance DECIMAL(15, 2) DEFAULT 0.00,
ADD COLUMN subscription_id UUID,
ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN trial_used BOOLEAN DEFAULT false,
ADD COLUMN custom_commission_percent DECIMAL(5, 2),
ADD COLUMN turnover_30_days DECIMAL(15, 2) DEFAULT 0.00,
ADD COLUMN commission_level_id UUID;

-- =============================================
-- 3. TRANSACTIONS TABLE
-- =============================================

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type transaction_type NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status transaction_status DEFAULT 'pending' NOT NULL,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  related_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. COMMISSION LEVELS TABLE
-- =============================================

CREATE TABLE public.commission_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_turnover DECIMAL(15, 2) NOT NULL,
  max_turnover DECIMAL(15, 2),
  percent DECIMAL(5, 2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.commission_levels ENABLE ROW LEVEL SECURITY;

-- Insert default commission levels
INSERT INTO public.commission_levels (name, min_turnover, max_turnover, percent) VALUES
('Bronze', 0, 1000, 8.0),
('Silver', 1000, 5000, 6.0),
('Gold', 5000, 15000, 4.0),
('Platinum', 15000, NULL, 2.0);

-- =============================================
-- 5. SUBSCRIPTIONS TABLE
-- =============================================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  trial_days INTEGER DEFAULT 0,
  trial_enabled BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Insert default subscription plans
INSERT INTO public.subscriptions (name, monthly_price, commission_percent, features, trial_enabled, trial_days, sort_order) VALUES
('Basic', 0.00, 5.0, '{"responses_limit": 10, "support": "basic"}', true, 7, 1),
('Pro', 29.99, 2.0, '{"responses_limit": "unlimited", "support": "priority", "fast_withdraw_commission": 0.5}', true, 14, 2),
('Elite', 99.99, 0.0, '{"responses_limit": "unlimited", "support": "vip", "fast_withdraw_commission": 0, "top_search": true, "analytics": true}', false, 0, 3);

-- =============================================
-- 6. PLATFORM SETTINGS TABLE
-- =============================================

CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
('auto_trial_enabled', 'true', 'Automatically give trial to new users'),
('default_trial_subscription_id', (SELECT id FROM public.subscriptions WHERE name = 'Basic'), 'Default trial subscription'),
('default_trial_days', '7', 'Default trial period in days'),
('global_commission_percent', '5.0', 'Global commission percentage'),
('commission_enabled', 'true', 'Enable commission system'),
('fast_withdraw_commission', '2.0', 'Fast withdraw commission percentage'),
('min_withdraw_amount', '10.00', 'Minimum withdrawal amount'),
('max_withdraw_amount', '10000.00', 'Maximum withdrawal amount');

-- =============================================
-- 7. PLATFORM INCOME TABLE
-- =============================================

CREATE TABLE public.platform_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source income_source NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.platform_income ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. DOCUMENTS TABLE
-- =============================================

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type document_type NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status document_status DEFAULT 'uploaded' NOT NULL,
  verification_notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 9. UPDATE DEALS TABLE WITH FINANCIAL FIELDS
-- =============================================

ALTER TABLE public.deals 
ADD COLUMN client_fee DECIMAL(15, 2),
ADD COLUMN carrier_earnings DECIMAL(15, 2),
ADD COLUMN platform_commission DECIMAL(15, 2),
ADD COLUMN commission_percent DECIMAL(5, 2),
ADD COLUMN frozen_amount DECIMAL(15, 2),
ADD COLUMN released_at TIMESTAMP WITH TIME ZONE;

-- =============================================
-- 10. UPDATE ORDERS TABLE WITH FINANCIAL FIELDS
-- =============================================

ALTER TABLE public.orders 
ADD COLUMN budget DECIMAL(15, 2),
ADD COLUMN is_priority BOOLEAN DEFAULT false,
ADD COLUMN promoted_until TIMESTAMP WITH TIME ZONE;

-- =============================================
-- 11. INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_related_order ON public.transactions(related_order_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX idx_transactions_idempotency_key ON public.transactions(idempotency_key);

CREATE INDEX idx_commission_levels_active ON public.commission_levels(is_active);
CREATE INDEX idx_commission_levels_turnover ON public.commission_levels(min_turnover, max_turnover);

CREATE INDEX idx_subscriptions_active ON public.subscriptions(is_active);
CREATE INDEX idx_subscriptions_sort_order ON public.subscriptions(sort_order);

CREATE INDEX idx_platform_income_source ON public.platform_income(source);
CREATE INDEX idx_platform_income_created_at ON public.platform_income(created_at);
CREATE INDEX idx_platform_income_related_user ON public.platform_income(related_user_id);

CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_order_id ON public.documents(order_id);
CREATE INDEX idx_documents_type ON public.documents(type);
CREATE INDEX idx_documents_status ON public.documents(status);

CREATE INDEX idx_profiles_subscription ON public.profiles(subscription_id);
CREATE INDEX idx_profiles_commission_level ON public.profiles(commission_level_id);

-- =============================================
-- 12. UPDATED_AT TRIGGERS FOR NEW TABLES
-- =============================================

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commission_levels_updated_at
  BEFORE UPDATE ON public.commission_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 13. RLS POLICIES - TRANSACTIONS
-- =============================================

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- System creates transactions (via function)
CREATE POLICY "System can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 14. RLS POLICIES - COMMISSION LEVELS
-- =============================================

-- Everyone can view active commission levels
CREATE POLICY "Everyone can view active commission levels"
  ON public.commission_levels FOR SELECT
  USING (is_active = true);

-- Admins can manage commission levels
CREATE POLICY "Admins can manage commission levels"
  ON public.commission_levels FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 15. RLS POLICIES - SUBSCRIPTIONS
-- =============================================

-- Everyone can view active subscriptions
CREATE POLICY "Everyone can view active subscriptions"
  ON public.subscriptions FOR SELECT
  USING (is_active = true);

-- Admins can manage subscriptions
CREATE POLICY "Admins can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 16. RLS POLICIES - PLATFORM SETTINGS
-- =============================================

-- Everyone can view platform settings
CREATE POLICY "Everyone can view platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

-- Admins can manage platform settings
CREATE POLICY "Admins can manage platform settings"
  ON public.platform_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 17. RLS POLICIES - PLATFORM INCOME
-- =============================================

-- Admins can view all platform income
CREATE POLICY "Admins can view all platform income"
  ON public.platform_income FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- System creates platform income records
CREATE POLICY "System can create platform income"
  ON public.platform_income FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 18. RLS POLICIES - DOCUMENTS
-- =============================================

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can upload their own documents
CREATE POLICY "Users can upload own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
  ON public.documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 19. FUNCTIONS FOR COMMISSION CALCULATION
-- =============================================

-- Function to calculate commission for user
CREATE OR REPLACE FUNCTION public.calculate_user_commission(
  user_id UUID,
  order_amount DECIMAL
) RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  custom_commission DECIMAL;
  subscription_commission DECIMAL;
  level_commission DECIMAL;
  global_commission DECIMAL;
  commission_enabled BOOLEAN;
  final_commission DECIMAL;
BEGIN
  -- Check if commission is enabled
  SELECT (value::text)::boolean INTO commission_enabled
  FROM public.platform_settings 
  WHERE key = 'commission_enabled';
  
  IF NOT commission_enabled THEN
    RETURN 0;
  END IF;
  
  -- Get global commission
  SELECT (value::text)::DECIMAL INTO global_commission
  FROM public.platform_settings 
  WHERE key = 'global_commission_percent';
  
  -- Check custom commission first
  SELECT custom_commission_percent INTO custom_commission
  FROM public.profiles 
  WHERE user_id = calculate_user_commission.user_id;
  
  IF custom_commission IS NOT NULL THEN
    RETURN order_amount * (custom_commission / 100);
  END IF;
  
  -- Check subscription commission
  SELECT s.commission_percent INTO subscription_commission
  FROM public.profiles p
  JOIN public.subscriptions s ON p.subscription_id = s.id
  WHERE p.user_id = calculate_user_commission.user_id
    AND p.subscription_expires_at > now();
  
  IF subscription_commission IS NOT NULL THEN
    RETURN order_amount * (subscription_commission / 100);
  END IF;
  
  -- Check commission level based on turnover
  SELECT cl.percent INTO level_commission
  FROM public.profiles p
  JOIN public.commission_levels cl ON p.commission_level_id = cl.id
  WHERE p.user_id = calculate_user_commission.user_id
    AND cl.is_active = true;
  
  IF level_commission IS NOT NULL THEN
    RETURN order_amount * (level_commission / 100);
  END IF;
  
  -- Return global commission as default
  RETURN order_amount * (global_commission / 100);
END;
$$;

-- Function to update user commission level based on turnover
CREATE OR REPLACE FUNCTION public.update_user_commission_level(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_turnover DECIMAL;
  level_id UUID;
BEGIN
  -- Get user's 30-day turnover
  SELECT turnover_30_days INTO user_turnover
  FROM public.profiles
  WHERE user_id = update_user_commission_level.user_id;
  
  -- Find appropriate commission level
  SELECT id INTO level_id
  FROM public.commission_levels
  WHERE is_active = true
    AND user_turnover >= min_turnover
    AND (max_turnover IS NULL OR user_turnover < max_turnover)
  ORDER BY min_turnover DESC
  LIMIT 1;
  
  -- Update user's commission level
  UPDATE public.profiles
  SET commission_level_id = level_id
  WHERE user_id = update_user_commission_level.user_id;
END;
$$;
