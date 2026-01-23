-- Allow carriers to view orders they have deals for
CREATE POLICY "Carriers can view orders through deals"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM deals 
    WHERE deals.order_id = orders.id 
    AND deals.carrier_id = auth.uid()
  )
);