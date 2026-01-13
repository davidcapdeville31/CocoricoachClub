-- Add subcategory column to exercise_library table
ALTER TABLE exercise_library 
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Add check constraint for valid subcategories
ALTER TABLE exercise_library 
ADD CONSTRAINT exercise_library_subcategory_check 
CHECK (subcategory IS NULL OR subcategory IN (
  'renforcement',
  'conditioning', 
  'halterophilie',
  'gymnastique',
  'plyometrie',
  'prophylaxie',
  'mobilite',
  'echauffement'
));