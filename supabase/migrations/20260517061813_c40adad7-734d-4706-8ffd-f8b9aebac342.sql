CREATE OR REPLACE FUNCTION public.trg_notify_competition_data_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only notify on INSERT, or on UPDATE when result changes
  IF TG_OP = 'UPDATE' AND NEW.result IS NOT DISTINCT FROM OLD.result THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_athlete_data_added(
    NEW.player_id,
    (SELECT category_id FROM public.matches WHERE id = NEW.match_id),
    'athlete_competition_data',
    '🏆 Donnée de compétition ajoutée',
    'Ton coach a enregistré tes données de compétition.',
    jsonb_build_object('round_id', NEW.id, 'match_id', NEW.match_id)
  );
  RETURN NEW;
END;
$function$;