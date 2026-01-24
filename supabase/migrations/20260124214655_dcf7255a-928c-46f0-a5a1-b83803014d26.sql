-- Fix RLS policy for ratings table - restrict to authenticated users
-- This addresses the PUBLIC_DATA_EXPOSURE security issue

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.ratings;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view ratings"
  ON public.ratings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);