-- Create favorite_carriers table for clients to save preferred carriers
CREATE TABLE public.favorite_carriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  carrier_id UUID NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, carrier_id)
);

-- Enable RLS
ALTER TABLE public.favorite_carriers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Clients can view own favorites"
ON public.favorite_carriers FOR SELECT
USING (auth.uid() = client_id);

CREATE POLICY "Clients can add favorites"
ON public.favorite_carriers FOR INSERT
WITH CHECK (auth.uid() = client_id AND has_role(auth.uid(), 'client'::app_role));

CREATE POLICY "Clients can remove favorites"
ON public.favorite_carriers FOR DELETE
USING (auth.uid() = client_id);

-- Index for faster lookups
CREATE INDEX idx_favorite_carriers_client ON public.favorite_carriers(client_id);
CREATE INDEX idx_favorite_carriers_carrier ON public.favorite_carriers(carrier_id);