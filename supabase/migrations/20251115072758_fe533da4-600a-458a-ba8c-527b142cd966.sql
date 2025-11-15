-- Add cover_image_url column to categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Create storage bucket for category cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-covers', 'category-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for category-covers bucket
CREATE POLICY "Anyone can view category cover images"
ON storage.objects FOR SELECT
USING (bucket_id = 'category-covers');

CREATE POLICY "Club owners can upload category cover images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'category-covers' AND
  EXISTS (
    SELECT 1 FROM categories
    JOIN clubs ON clubs.id = categories.club_id
    WHERE clubs.user_id = auth.uid()
    AND categories.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Club owners can update category cover images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'category-covers' AND
  EXISTS (
    SELECT 1 FROM categories
    JOIN clubs ON clubs.id = categories.club_id
    WHERE clubs.user_id = auth.uid()
    AND categories.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Club owners can delete category cover images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'category-covers' AND
  EXISTS (
    SELECT 1 FROM categories
    JOIN clubs ON clubs.id = categories.club_id
    WHERE clubs.user_id = auth.uid()
    AND categories.id::text = (storage.foldername(storage.objects.name))[1]
  )
);