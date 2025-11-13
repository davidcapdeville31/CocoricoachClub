-- Add foreign key constraints for injuries table
ALTER TABLE public.injuries
ADD CONSTRAINT injuries_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.injuries
ADD CONSTRAINT injuries_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Add foreign key constraints for training_periods table
ALTER TABLE public.training_periods
ADD CONSTRAINT training_periods_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- Add foreign key constraints for training_cycles table
ALTER TABLE public.training_cycles
ADD CONSTRAINT training_cycles_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;