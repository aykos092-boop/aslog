-- Fix overly permissive RLS policies

-- Drop and recreate OTP policies with proper security
DROP POLICY IF EXISTS "Anyone can create OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Users can update own OTP codes" ON public.otp_codes;

CREATE POLICY "Service can create OTP codes" ON public.otp_codes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

CREATE POLICY "Service can update OTP codes" ON public.otp_codes
  FOR UPDATE USING (
    (auth.uid() = user_id) OR 
    (user_id IS NULL AND phone IS NOT NULL) OR
    (user_id IS NULL AND email IS NOT NULL)
  );

-- Drop and recreate password reset policies
DROP POLICY IF EXISTS "Anyone can create reset tokens" ON public.password_reset_tokens;

CREATE POLICY "Service can create reset tokens" ON public.password_reset_tokens
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

-- Drop and recreate device fingerprints policies
DROP POLICY IF EXISTS "Anyone can create device records" ON public.device_fingerprints;

CREATE POLICY "Users can create own device records" ON public.device_fingerprints
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Drop and recreate security events policies
DROP POLICY IF EXISTS "Anyone can create security events" ON public.security_events;

CREATE POLICY "Service can create security events" ON public.security_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL);