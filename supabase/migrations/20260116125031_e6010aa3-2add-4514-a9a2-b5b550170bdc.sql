-- Drop the old constraint and add a new one that includes all sport types
ALTER TABLE public.categories DROP CONSTRAINT categories_rugby_type_check;

ALTER TABLE public.categories ADD CONSTRAINT categories_rugby_type_check 
CHECK (rugby_type = ANY (ARRAY['XV'::text, '7'::text, 'academie'::text, 'national_team'::text, 'football'::text, 'handball'::text, 'judo'::text, 'volleyball'::text]));