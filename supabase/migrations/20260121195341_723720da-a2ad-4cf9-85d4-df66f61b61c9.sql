-- Create storage bucket for cargo images
INSERT INTO storage.buckets (id, name, public)
VALUES ('cargo-images', 'cargo-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload cargo images
CREATE POLICY "Authenticated users can upload cargo images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cargo-images' 
  AND auth.uid() IS NOT NULL
);

-- Allow public read access to cargo images
CREATE POLICY "Anyone can view cargo images"
ON storage.objects FOR SELECT
USING (bucket_id = 'cargo-images');

-- Allow users to delete their own uploaded images
CREATE POLICY "Users can delete own cargo images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cargo-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add photo_urls column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';