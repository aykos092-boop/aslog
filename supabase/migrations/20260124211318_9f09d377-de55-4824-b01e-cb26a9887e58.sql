-- Fix security vulnerabilities in RLS policies

-- 1. Fix otp_codes SELECT policy - remove exposure of NULL user_id codes
DROP POLICY IF EXISTS "Users can view own OTP codes" ON public.otp_codes;
-- OTP verification should be server-side only via edge function
-- No client SELECT access needed

-- 2. Fix otp_codes INSERT policy - remove unauthenticated insert
DROP POLICY IF EXISTS "Service can create OTP codes" ON public.otp_codes;
-- Only service role (edge functions) can insert - no policy needed

-- 3. Fix otp_codes UPDATE policy - make it more restrictive
DROP POLICY IF EXISTS "Service can update OTP codes" ON public.otp_codes;
-- Only service role (edge functions) can update - no policy needed

-- 4. Fix password_reset_tokens INSERT policy
DROP POLICY IF EXISTS "Service can create reset tokens" ON public.password_reset_tokens;
-- Only service role (edge functions) can insert - no policy needed

-- 5. Fix device_fingerprints INSERT policy
DROP POLICY IF EXISTS "Users can create own device records" ON public.device_fingerprints;
CREATE POLICY "Authenticated users can create device records"
ON public.device_fingerprints FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 6. Fix security_events table - check if exists and fix
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'security_events') THEN
    DROP POLICY IF EXISTS "Service can create security events" ON public.security_events;
  END IF;
END $$;

-- 7. Fix geocode_cache INSERT policy
DROP POLICY IF EXISTS "Service role can insert geocode cache" ON public.geocode_cache;
-- Only service role can insert - no policy needed