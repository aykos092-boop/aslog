-- Create admin roles enum
CREATE TYPE public.admin_role AS ENUM ('super_admin', 'manager', 'operator', 'auditor');

-- Create KYC status enum
CREATE TYPE public.kyc_status AS ENUM ('not_started', 'pending', 'verified', 'rejected', 'manual_review');

-- Create registration status enum  
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected', 'resubmission_required');

-- Create admin_roles table for extended RBAC
CREATE TABLE public.admin_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  admin_role admin_role NOT NULL DEFAULT 'operator',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create kyc_documents table
CREATE TABLE public.kyc_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  passport_front_url TEXT,
  passport_back_url TEXT,
  selfie_url TEXT,
  video_selfie_url TEXT,
  extracted_data JSONB DEFAULT '{}',
  face_match_score NUMERIC,
  liveness_score NUMERIC,
  document_authenticity_score NUMERIC,
  status kyc_status NOT NULL DEFAULT 'not_started',
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create registration_requests table
CREATE TABLE public.registration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT,
  business_type TEXT,
  country TEXT,
  terms_accepted BOOLEAN DEFAULT false,
  privacy_accepted BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token TEXT,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  status registration_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  onboarding_step INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Admin roles policies
CREATE POLICY "Super admins can manage admin roles"
ON public.admin_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view admin roles"
ON public.admin_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs policies
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- KYC documents policies
CREATE POLICY "Users can view own KYC documents"
ON public.kyc_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own KYC documents"
ON public.kyc_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own KYC documents"
ON public.kyc_documents FOR UPDATE
USING (auth.uid() = user_id AND status IN ('not_started', 'rejected'));

CREATE POLICY "Admins can view all KYC documents"
ON public.kyc_documents FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update KYC documents"
ON public.kyc_documents FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Registration requests policies
CREATE POLICY "Users can view own registration"
ON public.registration_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own registration"
ON public.registration_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own registration"
ON public.registration_requests FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending', 'resubmission_required'));

CREATE POLICY "Admins can view all registrations"
ON public.registration_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update registrations"
ON public.registration_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Storage policies for KYC documents
CREATE POLICY "Users can upload own KYC documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));

-- Create function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data, p_ip_address, p_user_agent)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create function to get admin role
CREATE OR REPLACE FUNCTION public.get_admin_role(p_user_id UUID)
RETURNS admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_role FROM public.admin_roles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Create function to check admin permission
CREATE OR REPLACE FUNCTION public.has_admin_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = p_user_id
    AND (
      admin_role = 'super_admin'
      OR permissions->p_permission = 'true'::jsonb
    )
  );
$$;

-- Triggers for updated_at
CREATE TRIGGER update_admin_roles_updated_at
BEFORE UPDATE ON public.admin_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kyc_documents_updated_at
BEFORE UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_registration_requests_updated_at
BEFORE UPDATE ON public.registration_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();