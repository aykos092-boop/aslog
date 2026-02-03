-- Fix ai_conversations table for Firebase Authentication
-- Change user_id from UUID to TEXT to match Firebase UIDs

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view own ai conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can manage own ai conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can view own ai chat logs" ON public.ai_chat_logs;
DROP POLICY IF EXISTS "Users can create own ai chat logs" ON public.ai_chat_logs;
DROP POLICY IF EXISTS "Users can update own ai chat logs" ON public.ai_chat_logs;

-- Drop foreign key constraints if they exist
ALTER TABLE public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey;
ALTER TABLE public.ai_chat_logs DROP CONSTRAINT IF EXISTS ai_chat_logs_user_id_fkey;

-- Change user_id columns from UUID to TEXT
ALTER TABLE public.ai_conversations ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.ai_chat_logs ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Add comment for documentation
COMMENT ON TABLE public.ai_conversations IS 'AI conversations - Firebase Authentication (user_id is TEXT)';
COMMENT ON TABLE public.ai_chat_logs IS 'AI chat logs - Firebase Authentication (user_id is TEXT)';
