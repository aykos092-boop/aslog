-- Migration to support Firebase Authentication
-- Changes user_id columns from UUID to TEXT to support Firebase UIDs

-- 1. Drop ALL RLS policies from ALL tables first (comprehensive approach)
DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
    policy_rec RECORD;
BEGIN
    -- Drop all policies from all tables
    FOR policy_rec IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_rec.policyname, 
                      policy_rec.schemaname, 
                      policy_rec.tablename);
    END LOOP;
END $$;

-- 2. Now drop foreign key constraints that reference auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_client_id_fkey;
ALTER TABLE public.responses DROP CONSTRAINT IF EXISTS responses_order_id_fkey;
ALTER TABLE public.responses DROP CONSTRAINT IF EXISTS responses_carrier_id_fkey;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_client_id_fkey;
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_carrier_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.gps_locations DROP CONSTRAINT IF EXISTS gps_locations_carrier_id_fkey;
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_rater_id_fkey;
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_rated_id_fkey;

-- 3. Change user_id columns from UUID to TEXT
ALTER TABLE public.profiles ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.user_roles ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.orders ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;
ALTER TABLE public.responses ALTER COLUMN carrier_id TYPE TEXT USING carrier_id::TEXT;
ALTER TABLE public.deals ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;
ALTER TABLE public.deals ALTER COLUMN carrier_id TYPE TEXT USING carrier_id::TEXT;
ALTER TABLE public.messages ALTER COLUMN sender_id TYPE TEXT USING sender_id::TEXT;
ALTER TABLE public.gps_locations ALTER COLUMN carrier_id TYPE TEXT USING carrier_id::TEXT;
ALTER TABLE public.ratings ALTER COLUMN rater_id TYPE TEXT USING rater_id::TEXT;
ALTER TABLE public.ratings ALTER COLUMN rated_id TYPE TEXT USING rated_id::TEXT;

-- 4. Add missing columns to profiles table (if they don't exist)
DO $$
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='email'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
    
    -- Add email_verified column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='email_verified'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email_verified BOOLEAN DEFAULT false;
    END IF;
    
    -- Add phone_verified column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='phone_verified'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone_verified BOOLEAN DEFAULT false;
    END IF;
    
    -- Add referral_code column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='referral_code'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN referral_code TEXT UNIQUE;
    END IF;
END $$;

-- 5. Create a function to check if a user has a specific role (updated for TEXT)
CREATE OR REPLACE FUNCTION public.has_role_text(_user_id TEXT, _role app_role)
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

-- 6. Create a function to get user's primary role (updated for TEXT)
CREATE OR REPLACE FUNCTION public.get_user_role_text(_user_id TEXT)
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

-- Note: RLS policies will need to be recreated manually or in a separate migration
-- since we're moving away from Supabase auth to Firebase auth
