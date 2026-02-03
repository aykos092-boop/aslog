-- =============================================
-- ESCROW OPERATIONS TABLE
-- =============================================

-- Escrow operation status enum
CREATE TYPE public.escrow_status AS ENUM ('frozen', 'released', 'refunded');

-- Escrow operations table
CREATE TABLE public.escrow_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  carrier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  status escrow_status DEFAULT 'frozen' NOT NULL,
  frozen_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  related_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.escrow_operations ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_escrow_operations_order_id ON public.escrow_operations(order_id);
CREATE INDEX idx_escrow_operations_client_id ON public.escrow_operations(client_id);
CREATE INDEX idx_escrow_operations_carrier_id ON public.escrow_operations(carrier_id);
CREATE INDEX idx_escrow_operations_status ON public.escrow_operations(status);
CREATE INDEX idx_escrow_operations_frozen_at ON public.escrow_operations(frozen_at);

-- Updated_at trigger
CREATE TRIGGER update_escrow_operations_updated_at
  BEFORE UPDATE ON public.escrow_operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
-- Users can view their own escrow operations
CREATE POLICY "Users can view own escrow operations"
  ON public.escrow_operations FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = carrier_id);

-- Admins can view all escrow operations
CREATE POLICY "Admins can view all escrow operations"
  ON public.escrow_operations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- System can create escrow operations
CREATE POLICY "System can create escrow operations"
  ON public.escrow_operations FOR INSERT
  WITH CHECK (true);

-- System can update escrow operations
CREATE POLICY "System can update escrow operations"
  ON public.escrow_operations FOR UPDATE
  USING (true);

-- Function to check if order has frozen funds
CREATE OR REPLACE FUNCTION public.order_has_frozen_funds(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.escrow_operations 
    WHERE order_id = p_order_id 
      AND status = 'frozen'
  );
$$;

-- Function to get escrow summary for order
CREATE OR REPLACE FUNCTION public.get_escrow_summary(p_order_id UUID)
RETURNS TABLE(
  has_frozen_funds BOOLEAN,
  frozen_amount DECIMAL,
  status TEXT,
  frozen_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (status = 'frozen') as has_frozen_funds,
    amount as frozen_amount,
    status::text,
    frozen_at,
    released_at
  FROM public.escrow_operations
  WHERE order_id = p_order_id
  LIMIT 1;
$$;

-- Function to get user escrow balance
CREATE OR REPLACE FUNCTION public.get_user_escrow_balance(p_user_id UUID)
RETURNS TABLE(
  total_frozen DECIMAL,
  pending_releases DECIMAL,
  total_operations BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'frozen' THEN amount ELSE 0 END), 0) as total_frozen,
    COALESCE(SUM(CASE WHEN status = 'frozen' THEN amount ELSE 0 END), 0) as pending_releases,
    COUNT(*) as total_operations
  FROM public.escrow_operations
  WHERE client_id = p_user_id OR carrier_id = p_user_id;
$$;
