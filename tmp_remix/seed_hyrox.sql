-- Create exercise library table
CREATE TABLE public.exercise_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_name TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('débutant', 'intermédiaire', 'avancé')),
  is_variation BOOLEAN DEFAULT false,
  tips TEXT,
  coach_id UUID,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;

-- Coaches can view all default exercises and their own
CREATE POLICY "Coaches can view exercises"
  ON public.exercise_library
  FOR SELECT
  USING (is_default = true OR coach_id = auth.uid());

-- Coaches can create their own exercises
CREATE POLICY "Coaches can create exercises"
  ON public.exercise_library
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- Coaches can update their own exercises
CREATE POLICY "Coaches can update own exercises"
  ON public.exercise_library
  FOR UPDATE
  USING (coach_id = auth.uid());

-- Coaches can delete their own exercises
CREATE POLICY "Coaches can delete own exercises"
  ON public.exercise_library
  FOR DELETE
  USING (coach_id = auth.uid());

-- Public can view exercises via share token (for athletes)
CREATE POLICY "Public can view exercises via share token"
  ON public.exercise_library
  FOR SELECT
  USING (is_default = true);

-- Create updated_at trigger
CREATE TRIGGER update_exercise_library_updated_at
  BEFORE UPDATE ON public.exercise_library
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for exercise videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-videos', 'exercise-videos', true);

-- RLS policies for storage
CREATE POLICY "Public can view exercise videos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'exercise-videos');

CREATE POLICY "Coaches can upload exercise videos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'exercise-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Coaches can update their exercise videos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'exercise-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Coaches can delete their exercise videos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'exercise-videos' AND auth.role() = 'authenticated');

-- Insert default exercises for each HYROX station
INSERT INTO public.exercise_library (station_name, exercise_name, description, difficulty_level, is_default, tips) VALUES
('Ski Erg', 'Technique de base Ski Erg', 'Position assise, dos droit, mouvement fluide des bras en coordination avec les jambes. Focus sur la puissance explosive.', 'débutant', true, 'Gardez le dos droit et utilisez tout votre corps, pas seulement les bras.'),
('Ski Erg', 'Ski Erg intervalle court', 'Sprints de 30 secondes avec 30 secondes de repos. Développe la puissance anaérobie.', 'intermédiaire', true, 'Maintenez une cadence élevée pendant les sprints, récupérez activement.'),
('Sled Push', 'Sled Push technique', 'Mains sur les poignées hautes, corps incliné à 45°, poussée explosive avec les jambes.', 'débutant', true, 'Gardez le corps bas et stable, poussez avec les jambes pas avec les bras.'),
('Sled Push', 'Sled Push progressif', 'Augmentation progressive du poids sur 5 sets pour développer la force maximale.', 'avancé', true, 'Commencez léger pour la technique, augmentez progressivement.'),
('Sled Pull', 'Sled Pull main sur main', 'Traction alternée, position stable, utilisation du poids du corps.', 'débutant', true, 'Utilisez votre poids corporel, gardez les hanches basses.'),
('Sled Pull', 'Sled Pull rapide', 'Focus sur la vitesse de traction avec charge modérée.', 'intermédiaire', true, 'Mouvements rapides et courts, maintenez une bonne posture.'),
('Burpee Broad Jump', 'Burpee technique', 'Descente contrôlée, poitrine au sol, saut explosif en avant.', 'débutant', true, 'Atterrissez stable avant de redescendre, pas de pause inutile.'),
('Burpee Broad Jump', 'Burpee broad jump haute intensité', 'Enchaînement rapide avec distance maximale sur chaque saut.', 'avancé', true, 'Trouvez votre rythme, ne sacrifiez pas la distance pour la vitesse.'),
('Row', 'Rowing technique', 'Séquence jambes-dos-bras à la traction, inverse au retour. Damper réglé entre 115-125.', 'débutant', true, 'Gardez le dos droit, tirez le coude vers l''arrière.'),
('Row', 'Row intervalle pyramide', 'Intervalles croissants puis décroissants (100m-200m-300m-200m-100m) avec 1min repos.', 'intermédiaire', true, 'Maintenez la même intensité sur tous les intervalles.'),
('Farmers Carry', 'Farmers carry posture', 'Position verticale, épaules en arrière, regard devant, kettlebells/haltères lourds.', 'débutant', true, 'Gardez le torse droit, ne vous penchez pas sur les côtés.'),
('Farmers Carry', 'Farmers carry avec stops', 'Marche avec arrêts isométriques de 5-10 secondes tous les 10 mètres.', 'avancé', true, 'Les pauses renforcent la stabilité du core.'),
('Sandbag Lunges', 'Lunges technique', 'Genou arrière frôle le sol, buste droit, sandbag sur les épaules.', 'débutant', true, 'Contrôlez la descente, gardez le poids sur le talon avant.'),
('Sandbag Lunges', 'Lunges walking tempo', 'Fentes marchées avec tempo contrôlé (3 secondes descente, 1 seconde montée).', 'intermédiaire', true, 'Le tempo lent développe la force et le contrôle.'),
('Wall Balls', 'Wall ball technique', 'Squat complet, lancer explosif, cible à 3m (H) ou 2.7m (F).', 'débutant', true, 'Descendez en squat complet, utilisez la force des jambes pour lancer.'),
('Wall Balls', 'Wall ball endurance', 'Sets de 25-50 reps non-stop pour développer l''endurance musculaire.', 'intermédiaire', true, 'Trouvez votre rythme, respirez sur chaque rep.');
