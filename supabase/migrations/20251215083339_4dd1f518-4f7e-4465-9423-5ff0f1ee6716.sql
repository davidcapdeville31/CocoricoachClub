-- Add missing foreign keys for mobility_tests and jump_tests tables
ALTER TABLE public.mobility_tests
ADD CONSTRAINT mobility_tests_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.mobility_tests
ADD CONSTRAINT mobility_tests_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.jump_tests
ADD CONSTRAINT jump_tests_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.jump_tests
ADD CONSTRAINT jump_tests_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;