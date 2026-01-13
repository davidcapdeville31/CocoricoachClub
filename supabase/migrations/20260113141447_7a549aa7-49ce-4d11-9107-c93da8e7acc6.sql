-- Fix RLS: let any role (public/anon/authenticated) see system exercises
DROP POLICY IF EXISTS "System exercises are viewable" ON public.exercise_library;

CREATE POLICY "System exercises are viewable"
ON public.exercise_library
FOR SELECT
TO public
USING (is_system IS TRUE);