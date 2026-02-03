-- =============================================
-- Documents System Migration
-- =============================================

-- Document Types Enum (extend existing)
-- Check if values already exist before adding
DO $$
BEGIN
  -- Add new document types if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'order_confirmation' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')) THEN
    ALTER TYPE public.document_type ADD VALUE 'order_confirmation';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'shipping_manifest' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')) THEN
    ALTER TYPE public.document_type ADD VALUE 'shipping_manifest';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'receiving_report' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')) THEN
    ALTER TYPE public.document_type ADD VALUE 'receiving_report';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'inventory_report' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')) THEN
    ALTER TYPE public.document_type ADD VALUE 'inventory_report';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'warehouse_receipt' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')) THEN
    ALTER TYPE public.document_type ADD VALUE 'warehouse_receipt';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'delivery_note' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')) THEN
    ALTER TYPE public.document_type ADD VALUE 'delivery_note';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'customs_declaration' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')) THEN
    ALTER TYPE public.document_type ADD VALUE 'customs_declaration';
  END IF;
END $$;

-- Document Status Enum (extend existing)
DO $$
BEGIN
  -- Add new document statuses if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'draft' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_status')) THEN
    ALTER TYPE public.document_status ADD VALUE 'draft';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_status')) THEN
    ALTER TYPE public.document_status ADD VALUE 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'approved' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_status')) THEN
    ALTER TYPE public.document_status ADD VALUE 'approved';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'final' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_status')) THEN
    ALTER TYPE public.document_status ADD VALUE 'final';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelled' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_status')) THEN
    ALTER TYPE public.document_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- =============================================
-- DOCUMENTS TABLE
-- =============================================
-- Drop existing documents table if it exists (from monetization system)
DROP TABLE IF EXISTS public.documents CASCADE;

-- Create new documents table for WMS system
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT UNIQUE NOT NULL,
  document_type document_type NOT NULL,
  status document_status DEFAULT 'draft' NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Relations
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Content
  content JSONB, -- Document structured data
  metadata JSONB, -- Additional metadata
  
  -- File info
  file_path TEXT, -- Path to PDF file
  file_size BIGINT, -- File size in bytes
  file_hash TEXT, -- SHA256 hash for integrity
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT documents_status_check CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
    (status != 'approved')
  )
);

-- Indexes for performance
CREATE INDEX idx_documents_type ON public.documents(document_type);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_order_id ON public.documents(order_id);
CREATE INDEX idx_documents_deal_id ON public.documents(deal_id);
CREATE INDEX idx_documents_warehouse_id ON public.documents(warehouse_id);
CREATE INDEX idx_documents_created_by ON public.documents(created_by);
CREATE INDEX idx_documents_created_at ON public.documents(created_at);
CREATE INDEX idx_documents_file_path ON public.documents(file_path) WHERE file_path IS NOT NULL;

-- =============================================
-- DOCUMENT ITEMS TABLE (for line items)
-- =============================================
DROP TABLE IF EXISTS public.document_items CASCADE;

CREATE TABLE public.document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  item_sequence INTEGER NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_price DECIMAL(12, 2),
  total_price DECIMAL(12, 2),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  UNIQUE(document_id, item_sequence)
);

-- =============================================
-- DOCUMENT SIGNATURES TABLE
-- =============================================
DROP TABLE IF EXISTS public.document_signatures CASCADE;

CREATE TABLE public.document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  signature_type TEXT NOT NULL, -- 'created', 'approved', 'witness'
  signature_data JSONB, -- Digital signature data
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  UNIQUE(document_id, signature_type, user_id)
);

-- =============================================
-- SECURITY FUNCTIONS
-- =============================================

-- Function to check document access
CREATE OR REPLACE FUNCTION public.has_document_access(_user_id UUID, _document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin can access all documents
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id::text = _user_id::text
      AND ur.role::text = 'admin'
  )
  UNION ALL
  -- Users can access their own documents
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = _document_id
      AND d.created_by::text = _user_id::text
  )
  UNION ALL
  -- Users can access documents related to their orders/deals
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    LEFT JOIN public.orders o ON d.order_id = o.id
    LEFT JOIN public.deals dl ON d.deal_id = dl.id
    WHERE d.id = _document_id
      AND (
        (o.client_id::text = _user_id::text) OR
        (dl.client_id::text = _user_id::text) OR
        (dl.carrier_id::text = _user_id::text)
      )
  )
  LIMIT 1;
$$;

-- Function to generate document number
CREATE OR REPLACE FUNCTION public.generate_document_number(_type document_type)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  sequence_num BIGINT;
  year_part TEXT;
BEGIN
  -- Get prefix based on document type
  CASE _type
    WHEN 'order_confirmation' THEN prefix := 'ORD';
    WHEN 'shipping_manifest' THEN prefix := 'SHP';
    WHEN 'receiving_report' THEN prefix := 'REC';
    WHEN 'inventory_report' THEN prefix := 'INV';
    WHEN 'warehouse_receipt' THEN prefix := 'WHR';
    WHEN 'delivery_note' THEN prefix := 'DEL';
    WHEN 'invoice' THEN prefix := 'INV';
    WHEN 'customs_declaration' THEN prefix := 'CUS';
    ELSE prefix := 'DOC';
  END CASE;
  
  -- Get current year
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Generate sequence number (simplified - in production use proper sequence)
  sequence_num := (
    SELECT COALESCE(MAX(CAST(SUBSTRING(document_number FROM '[0-9]+$') AS BIGINT)), 0) + 1
    FROM public.documents
    WHERE document_type = _type
      AND document_number LIKE prefix || '/' || year_part || '/%'
  );
  
  RETURN prefix || '/' || year_part || '/' || LPAD(sequence_num::TEXT, 6, '0');
END;
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- Documents RLS Policies
CREATE POLICY "Admins can view all documents" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id::text = auth.uid()::text
        AND ur.role::text = 'admin'
    )
  );

CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (
    created_by::text = auth.uid()::text
  );

CREATE POLICY "Users can view related order/deal documents" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = documents.order_id
        AND o.client_id::text = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = documents.deal_id
        AND (d.client_id::text = auth.uid()::text OR d.carrier_id::text = auth.uid()::text)
    )
  );

CREATE POLICY "Admins can insert documents" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id::text = auth.uid()::text
        AND ur.role::text = 'admin'
    )
  );

CREATE POLICY "Admins can update documents" ON public.documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id::text = auth.uid()::text
        AND ur.role::text = 'admin'
    )
  );

CREATE POLICY "Admins can delete documents" ON public.documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id::text = auth.uid()::text
        AND ur.role::text = 'admin'
    )
  );

-- Document Items RLS Policies (inherit from documents)
CREATE POLICY "Document items access based on document" ON public.document_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_items.document_id
        AND (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id::text = auth.uid()::text
              AND ur.role::text = 'admin'
          )
          OR d.created_by::text = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = d.order_id
              AND o.client_id::text = auth.uid()::text
          )
          OR EXISTS (
            SELECT 1 FROM public.deals dl
            WHERE dl.id = d.deal_id
              AND (dl.client_id::text = auth.uid()::text OR dl.carrier_id::text = auth.uid()::text)
          )
        )
    )
  );

-- Document Signatures RLS Policies
CREATE POLICY "Document signatures access based on document" ON public.document_signatures
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_signatures.document_id
        AND (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id::text = auth.uid()::text
              AND ur.role::text = 'admin'
          )
          OR d.created_by::text = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = d.order_id
              AND o.client_id::text = auth.uid()::text
          )
          OR EXISTS (
            SELECT 1 FROM public.deals dl
            WHERE dl.id = d.deal_id
              AND (dl.client_id::text = auth.uid()::text OR dl.carrier_id::text = auth.uid()::text)
          )
        )
    )
  );

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate document number
CREATE OR REPLACE FUNCTION public.set_document_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_number IS NULL OR NEW.document_number = '' THEN
    NEW.document_number := public.generate_document_number(NEW.document_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_document_number_trigger
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_number();

-- Auto-create signature on document creation
CREATE OR REPLACE FUNCTION public.create_creation_signature()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.document_signatures (document_id, user_id, signature_type, ip_address, user_agent)
  VALUES (NEW.id, NEW.created_by, 'created', inet_client_addr(), current_setting('request.headers')::json->>'user-agent');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_creation_signature_trigger
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_creation_signature();

-- =============================================
-- STORAGE POLICY FOR DOCUMENTS
-- =============================================

-- Create storage bucket for documents (run this separately in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
DROP POLICY IF EXISTS "Admins can upload document files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own document files" ON storage.objects;

CREATE POLICY "Admins can upload document files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id::text = auth.uid()::text
        AND ur.role::text = 'admin'
    )
  );

CREATE POLICY "Admins can view document files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id::text = auth.uid()::text
        AND ur.role::text = 'admin'
    )
  );

CREATE POLICY "Users can view own document files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
        AND d.created_by::text = auth.uid()::text
    )
  );
