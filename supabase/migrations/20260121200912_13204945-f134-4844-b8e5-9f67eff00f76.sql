-- AI Chat Analytics table
CREATE TABLE public.ai_chat_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  response_time_ms INTEGER,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Loyalty points balance
CREATE TABLE public.loyalty_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Loyalty transactions history
CREATE TABLE public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'spent', 'expired', 'bonus')),
  reason TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Loyalty rewards catalog
CREATE TABLE public.loyalty_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount NUMERIC CHECK (discount_amount >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- AI chat logs policies
CREATE POLICY "Users can create own chat logs"
ON public.ai_chat_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat logs"
ON public.ai_chat_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all chat logs"
ON public.ai_chat_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Loyalty points policies
CREATE POLICY "Users can view own loyalty points"
ON public.loyalty_points FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own loyalty points"
ON public.loyalty_points FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loyalty points"
ON public.loyalty_points FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all loyalty points"
ON public.loyalty_points FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Loyalty transactions policies
CREATE POLICY "Users can view own transactions"
ON public.loyalty_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
ON public.loyalty_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
ON public.loyalty_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Loyalty rewards policies (public read)
CREATE POLICY "Anyone can view active rewards"
ON public.loyalty_rewards FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage rewards"
ON public.loyalty_rewards FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_ai_chat_logs_user ON public.ai_chat_logs(user_id);
CREATE INDEX idx_ai_chat_logs_created ON public.ai_chat_logs(created_at);
CREATE INDEX idx_loyalty_points_user ON public.loyalty_points(user_id);
CREATE INDEX idx_loyalty_transactions_user ON public.loyalty_transactions(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_loyalty_points_updated_at
BEFORE UPDATE ON public.loyalty_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default rewards
INSERT INTO public.loyalty_rewards (name, description, points_cost, discount_percent)
VALUES 
  ('Скидка 5%', 'Скидка 5% на следующий заказ', 500, 5),
  ('Скидка 10%', 'Скидка 10% на следующий заказ', 900, 10),
  ('Скидка 15%', 'Скидка 15% на следующий заказ', 1200, 15);

INSERT INTO public.loyalty_rewards (name, description, points_cost, discount_amount)
VALUES 
  ('Скидка 300₽', 'Фиксированная скидка 300 рублей', 300, 300),
  ('Скидка 1000₽', 'Фиксированная скидка 1000 рублей', 800, 1000);