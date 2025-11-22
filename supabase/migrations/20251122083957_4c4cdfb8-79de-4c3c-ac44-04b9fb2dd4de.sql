-- Désactiver temporairement le trigger pour tester
DROP TRIGGER IF EXISTS on_injury_status_change ON public.injuries;

-- Recréer le trigger sans la fonction problématique
-- On le recréera plus tard une fois le problème résolu