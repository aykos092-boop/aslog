-- Drop triggers that depend on the function first
DROP TRIGGER IF EXISTS trigger_message_notification ON public.messages;
DROP TRIGGER IF EXISTS trigger_response_notification ON public.responses;
DROP TRIGGER IF EXISTS trigger_deal_status_notification ON public.deals;

-- Now drop the function
DROP FUNCTION IF EXISTS public.notify_push_notification();

-- Add client_price column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_price numeric DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.orders.client_price IS 'Price set by client for the order';