-- Create table for bowling oil patterns
CREATE TABLE public.bowling_oil_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  
  -- Identification
  name TEXT NOT NULL,
  is_preset BOOLEAN DEFAULT false,
  
  -- Dimensions
  length_feet DECIMAL(5,2),
  buff_distance_feet DECIMAL(5,2),
  width_boards INTEGER,
  
  -- Volume and distribution
  total_volume_ml DECIMAL(6,2),
  oil_ratio TEXT,
  profile_type TEXT CHECK (profile_type IN ('flat', 'crown', 'reverse_block')),
  
  -- Oil distribution
  forward_oil BOOLEAN DEFAULT true,
  reverse_oil BOOLEAN DEFAULT true,
  outside_friction TEXT CHECK (outside_friction IN ('low', 'medium', 'high')),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bowling_oil_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view oil patterns for accessible categories"
ON public.bowling_oil_patterns
FOR SELECT
TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can insert oil patterns for modifiable categories"
ON public.bowling_oil_patterns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
);

CREATE POLICY "Users can update oil patterns for modifiable categories"
ON public.bowling_oil_patterns
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
);

CREATE POLICY "Users can delete oil patterns for modifiable categories"
ON public.bowling_oil_patterns
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_bowling_oil_patterns_updated_at
BEFORE UPDATE ON public.bowling_oil_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();