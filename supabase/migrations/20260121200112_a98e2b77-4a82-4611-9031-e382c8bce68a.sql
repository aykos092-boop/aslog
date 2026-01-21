-- Promo codes table
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount NUMERIC CHECK (discount_amount >= 0),
  min_order_weight NUMERIC DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Promo usage tracking
CREATE TABLE public.promo_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_applied NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI conversations history
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Promo codes policies (public read for active codes)
CREATE POLICY "Anyone can view active promo codes"
ON public.promo_codes FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Promo usages policies
CREATE POLICY "Users can view own promo usages"
ON public.promo_usages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own promo usages"
ON public.promo_usages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all promo usages"
ON public.promo_usages FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- AI conversations policies
CREATE POLICY "Users can view own AI conversations"
ON public.ai_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own AI conversations"
ON public.ai_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI conversations"
ON public.ai_conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI conversations"
ON public.ai_conversations FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX idx_promo_usages_user ON public.promo_usages(user_id);
CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample promo codes
INSERT INTO public.promo_codes (code, description, discount_percent, min_order_weight, max_uses)
VALUES 
  ('WELCOME10', 'Скидка 10% для новых клиентов', 10, 0, 100),
  ('CARGO500', 'Скидка 500₽ на заказы от 100кг', NULL, 100, 50),
  ('VIP20', 'VIP скидка 20% для постоянных клиентов', 20, 0, NULL);

UPDATE public.promo_codes SET discount_amount = 500 WHERE code = 'CARGO500';