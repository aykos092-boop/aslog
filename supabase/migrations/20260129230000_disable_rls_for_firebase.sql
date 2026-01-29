-- Disable Row Level Security for Firebase Authentication
-- This migration disables RLS on tables used by Firebase users
-- allowing direct database access without authentication restrictions

-- Disable RLS on Firebase user tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Temp open access" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Temp open access" ON public.user_roles;

DROP POLICY IF EXISTS "Users can view own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.ai_conversations;
DROP POLICY IF EXISTS "Temp open access" ON public.ai_conversations;

-- Add comment for documentation
COMMENT ON TABLE public.profiles IS 'User profiles - Firebase Authentication (RLS Disabled)';
COMMENT ON TABLE public.user_roles IS 'User roles - Firebase Authentication (RLS Disabled)';
COMMENT ON TABLE public.ai_conversations IS 'AI conversations - Firebase Authentication (RLS Disabled)';
