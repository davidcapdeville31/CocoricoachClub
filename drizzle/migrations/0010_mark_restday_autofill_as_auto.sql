-- Les jours de repos auto-remplis (RPE 0, durée 0, sans séance) n'avaient pas
-- le marqueur auto_filled : ils apparaissaient comme des saisies réelles dans
-- « RPE prévu/réel ». On les marque définitivement comme automatiques.
UPDATE public.awcr_tracking
SET auto_filled = true
WHERE training_session_id IS NULL
  AND COALESCE(rpe, 0) = 0
  AND COALESCE(duration_minutes, 0) = 0
  AND auto_filled = false;