-- Add Telegram verification fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT,
ADD COLUMN IF NOT EXISTS telegram_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS telegram_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for telegram_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);

-- Add unique constraint for telegram_id (one telegram_id = one user)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_telegram_id_unique UNIQUE (telegram_id);

-- RLS policy for updating telegram verification
CREATE POLICY "Users can update their own telegram verification" ON public.profiles
  FOR UPDATE 
  USING (
    id::text = auth.uid()::text
  );
