-- Fix overly permissive RLS policies

-- Drop the permissive audit_logs insert policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Create more restrictive audit logs insert policy (only authenticated users)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop the permissive notifications insert policy
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- Create more restrictive notifications insert policy (only authenticated users)
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);