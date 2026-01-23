-- Create table for custom training types per category
CREATE TABLE public.custom_training_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(category_id, name)
);

-- Enable RLS
ALTER TABLE public.custom_training_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view custom training types for their categories"
ON public.custom_training_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON c.club_id = cl.id
    WHERE c.id = category_id AND cl.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM category_members cm
    WHERE cm.category_id = custom_training_types.category_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create custom training types for their categories"
ON public.custom_training_types
FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND (
    EXISTS (
      SELECT 1 FROM categories c
      JOIN clubs cl ON c.club_id = cl.id
      WHERE c.id = category_id AND cl.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM category_members cm
      WHERE cm.category_id = custom_training_types.category_id AND cm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete their own custom training types"
ON public.custom_training_types
FOR DELETE
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON c.club_id = cl.id
    WHERE c.id = category_id AND cl.user_id = auth.uid()
  )
);