-- Add image column to custom_tests
ALTER TABLE public.custom_tests ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create public bucket for test images
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-images', 'test-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
DROP POLICY IF EXISTS "Test images are publicly accessible" ON storage.objects;
CREATE POLICY "Test images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-images');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated users can upload test images" ON storage.objects;
CREATE POLICY "Authenticated users can upload test images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test-images');

-- Authenticated users can update
DROP POLICY IF EXISTS "Authenticated users can update test images" ON storage.objects;
CREATE POLICY "Authenticated users can update test images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'test-images');

-- Authenticated users can delete
DROP POLICY IF EXISTS "Authenticated users can delete test images" ON storage.objects;
CREATE POLICY "Authenticated users can delete test images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'test-images');