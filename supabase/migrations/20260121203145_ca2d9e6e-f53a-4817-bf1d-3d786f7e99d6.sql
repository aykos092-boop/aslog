-- Create carrier notification preferences table
CREATE TABLE public.carrier_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id uuid NOT NULL UNIQUE,
  preferred_routes text[] DEFAULT '{}',
  preferred_cargo_types text[] DEFAULT '{}',
  min_weight numeric DEFAULT NULL,
  max_weight numeric DEFAULT NULL,
  notify_all boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.carrier_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Carriers can view own preferences" 
ON public.carrier_preferences FOR SELECT 
USING (auth.uid() = carrier_id);

CREATE POLICY "Carriers can create own preferences" 
ON public.carrier_preferences FOR INSERT 
WITH CHECK (auth.uid() = carrier_id);

CREATE POLICY "Carriers can update own preferences" 
ON public.carrier_preferences FOR UPDATE 
USING (auth.uid() = carrier_id);

-- Create price negotiations table for bargaining
CREATE TABLE public.price_negotiations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.responses(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL,
  proposed_price numeric NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'counter')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_negotiations ENABLE ROW LEVEL SECURITY;

-- Policies for negotiations
CREATE POLICY "Participants can view negotiations" 
ON public.price_negotiations FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders WHERE orders.id = price_negotiations.order_id AND orders.client_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM responses WHERE responses.id = price_negotiations.response_id AND responses.carrier_id = auth.uid()
  ) OR
  proposed_by = auth.uid()
);

CREATE POLICY "Users can create negotiations" 
ON public.price_negotiations FOR INSERT 
WITH CHECK (auth.uid() = proposed_by);

CREATE POLICY "Participants can update negotiations" 
ON public.price_negotiations FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM orders WHERE orders.id = price_negotiations.order_id AND orders.client_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM responses WHERE responses.id = price_negotiations.response_id AND responses.carrier_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_carrier_preferences_updated_at
BEFORE UPDATE ON public.carrier_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();