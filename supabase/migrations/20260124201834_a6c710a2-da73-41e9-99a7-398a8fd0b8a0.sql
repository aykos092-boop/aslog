-- Create table for Firebase user roles mapping
CREATE TABLE public.firebase_user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add firebase_uid to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_firebase_user_roles_uid ON public.firebase_user_roles(firebase_uid);

-- Enable RLS
ALTER TABLE public.firebase_user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for firebase_user_roles
CREATE POLICY "Users can view their own role" 
ON public.firebase_user_roles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own role" 
ON public.firebase_user_roles 
FOR INSERT 
WITH CHECK (true);

-- Update trigger for updated_at
CREATE TRIGGER update_firebase_user_roles_updated_at
BEFORE UPDATE ON public.firebase_user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();