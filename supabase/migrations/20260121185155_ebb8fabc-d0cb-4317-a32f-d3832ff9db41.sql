-- =============================================
-- 1. ENUMS
-- =============================================

-- User roles enum
CREATE TYPE public.app_role AS ENUM ('client', 'carrier', 'admin');

-- Order status enum
CREATE TYPE public.order_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

-- Deal status enum
CREATE TYPE public.deal_status AS ENUM ('pending', 'accepted', 'in_transit', 'delivered', 'cancelled');

-- Carrier type enum
CREATE TYPE public.carrier_type AS ENUM ('driver', 'company');

-- =============================================
-- 2. PROFILES TABLE
-- =============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  carrier_type carrier_type, -- only for carriers
  vehicle_type TEXT, -- only for drivers
  company_name TEXT, -- only for companies
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. USER ROLES TABLE (separate for security)
-- =============================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. SECURITY DEFINER FUNCTION FOR ROLE CHECK
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- =============================================
-- 5. ORDERS TABLE (shipping requests)
-- =============================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cargo_type TEXT NOT NULL,
  weight DECIMAL(10, 2),
  length DECIMAL(10, 2),
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  pickup_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  pickup_date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  status order_status DEFAULT 'open' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. RESPONSES TABLE (carrier responses)
-- =============================================

CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  carrier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  delivery_time TEXT,
  comment TEXT,
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (order_id, carrier_id)
);

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. DEALS TABLE (confirmed deals)
-- =============================================

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  carrier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agreed_price DECIMAL(12, 2) NOT NULL,
  status deal_status DEFAULT 'pending' NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  proof_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. MESSAGES TABLE (chat)
-- =============================================

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT messages_context_check CHECK (
    (deal_id IS NOT NULL AND order_id IS NULL) OR 
    (deal_id IS NULL AND order_id IS NOT NULL)
  )
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- =============================================
-- 9. GPS LOCATIONS TABLE
-- =============================================

CREATE TABLE public.gps_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  carrier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.gps_locations ENABLE ROW LEVEL SECURITY;

-- Enable realtime for GPS
ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_locations;

-- =============================================
-- 10. RATINGS TABLE
-- =============================================

CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  rater_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rated_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (deal_id, rater_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 11. RLS POLICIES - PROFILES
-- =============================================

-- Everyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 12. RLS POLICIES - USER ROLES
-- =============================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own role during signup
CREATE POLICY "Users can insert own role"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 13. RLS POLICIES - ORDERS
-- =============================================

-- Clients can view their own orders
CREATE POLICY "Clients can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = client_id);

-- Carriers can view open orders
CREATE POLICY "Carriers can view open orders"
  ON public.orders FOR SELECT
  USING (
    status = 'open' AND 
    (public.has_role(auth.uid(), 'carrier'))
  );

-- Clients can create orders
CREATE POLICY "Clients can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    auth.uid() = client_id AND 
    public.has_role(auth.uid(), 'client')
  );

-- Clients can update their own orders
CREATE POLICY "Clients can update own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = client_id);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any order
CREATE POLICY "Admins can update any order"
  ON public.orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 14. RLS POLICIES - RESPONSES
-- =============================================

-- Carriers can view their own responses
CREATE POLICY "Carriers can view own responses"
  ON public.responses FOR SELECT
  USING (auth.uid() = carrier_id);

-- Clients can view responses to their orders
CREATE POLICY "Clients can view responses to own orders"
  ON public.responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = responses.order_id 
      AND orders.client_id = auth.uid()
    )
  );

-- Carriers can create responses
CREATE POLICY "Carriers can create responses"
  ON public.responses FOR INSERT
  WITH CHECK (
    auth.uid() = carrier_id AND 
    public.has_role(auth.uid(), 'carrier')
  );

-- Clients can accept responses (update is_accepted)
CREATE POLICY "Clients can accept responses"
  ON public.responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = responses.order_id 
      AND orders.client_id = auth.uid()
    )
  );

-- Admins can view all responses
CREATE POLICY "Admins can view all responses"
  ON public.responses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 15. RLS POLICIES - DEALS
-- =============================================

-- Participants can view their deals
CREATE POLICY "Participants can view their deals"
  ON public.deals FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = carrier_id);

-- System creates deals (via function)
CREATE POLICY "Clients can create deals"
  ON public.deals FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Participants can update deals
CREATE POLICY "Participants can update deals"
  ON public.deals FOR UPDATE
  USING (auth.uid() = client_id OR auth.uid() = carrier_id);

-- Admins can view all deals
CREATE POLICY "Admins can view all deals"
  ON public.deals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any deal
CREATE POLICY "Admins can update any deal"
  ON public.deals FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 16. RLS POLICIES - MESSAGES
-- =============================================

-- Users can view messages in their deals
CREATE POLICY "Users can view deal messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deals 
      WHERE deals.id = messages.deal_id 
      AND (deals.client_id = auth.uid() OR deals.carrier_id = auth.uid())
    )
  );

-- Users can view messages in orders they participate in
CREATE POLICY "Users can view order messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = messages.order_id 
      AND orders.client_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.responses 
      WHERE responses.order_id = messages.order_id 
      AND responses.carrier_id = auth.uid()
    )
  );

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 17. RLS POLICIES - GPS LOCATIONS
-- =============================================

-- Deal participants can view GPS
CREATE POLICY "Deal participants can view GPS"
  ON public.gps_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deals 
      WHERE deals.id = gps_locations.deal_id 
      AND (deals.client_id = auth.uid() OR deals.carrier_id = auth.uid())
    )
  );

-- Carriers can insert GPS locations
CREATE POLICY "Carriers can insert GPS"
  ON public.gps_locations FOR INSERT
  WITH CHECK (auth.uid() = carrier_id);

-- Admins can view all GPS
CREATE POLICY "Admins can view all GPS"
  ON public.gps_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 18. RLS POLICIES - RATINGS
-- =============================================

-- Everyone can view ratings
CREATE POLICY "Ratings are viewable by everyone"
  ON public.ratings FOR SELECT
  USING (true);

-- Deal participants can create ratings
CREATE POLICY "Deal participants can rate"
  ON public.ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id AND
    EXISTS (
      SELECT 1 FROM public.deals 
      WHERE deals.id = ratings.deal_id 
      AND deals.status = 'delivered'
      AND (deals.client_id = auth.uid() OR deals.carrier_id = auth.uid())
    )
  );

-- =============================================
-- 19. TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 20. INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_orders_client_id ON public.orders(client_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_responses_order_id ON public.responses(order_id);
CREATE INDEX idx_responses_carrier_id ON public.responses(carrier_id);
CREATE INDEX idx_deals_client_id ON public.deals(client_id);
CREATE INDEX idx_deals_carrier_id ON public.deals(carrier_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_messages_deal_id ON public.messages(deal_id);
CREATE INDEX idx_messages_order_id ON public.messages(order_id);
CREATE INDEX idx_gps_locations_deal_id ON public.gps_locations(deal_id);
CREATE INDEX idx_ratings_rated_id ON public.ratings(rated_id);