-- Fix security warnings: Set search_path for functions

-- Update notify_new_injury function with search_path
CREATE OR REPLACE FUNCTION notify_new_injury()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_player_name TEXT;
BEGIN
  -- Get user_id from club
  SELECT clubs.user_id, players.name INTO v_user_id, v_player_name
  FROM categories
  JOIN clubs ON clubs.id = categories.club_id
  JOIN players ON players.id = NEW.player_id
  WHERE categories.id = NEW.category_id;

  -- Create notification
  INSERT INTO public.notifications (
    user_id,
    category_id,
    injury_id,
    notification_type,
    title,
    message
  ) VALUES (
    v_user_id,
    NEW.category_id,
    NEW.id,
    'new_injury',
    'Nouvelle blessure enregistrée',
    format('Le joueur %s s''est blessé (%s). Retour estimé: %s', 
      v_player_name, 
      NEW.injury_type,
      COALESCE(TO_CHAR(NEW.estimated_return_date, 'DD/MM/YYYY'), 'Non défini')
    )
  );

  RETURN NEW;
END;
$$;

-- Update notify_injury_status_change function with search_path
CREATE OR REPLACE FUNCTION notify_injury_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_player_name TEXT;
  v_status_label TEXT;
BEGIN
  -- Only notify if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get user_id and player name
    SELECT clubs.user_id, players.name INTO v_user_id, v_player_name
    FROM categories
    JOIN clubs ON clubs.id = categories.club_id
    JOIN players ON players.id = NEW.player_id
    WHERE categories.id = NEW.category_id;

    -- Translate status to French
    v_status_label := CASE NEW.status
      WHEN 'active' THEN 'active'
      WHEN 'in_rehab' THEN 'en rééducation'
      WHEN 'guérie' THEN 'guérie'
      ELSE NEW.status
    END;

    -- Create notification
    INSERT INTO public.notifications (
      user_id,
      category_id,
      injury_id,
      notification_type,
      title,
      message
    ) VALUES (
      v_user_id,
      NEW.category_id,
      NEW.id,
      'status_change',
      'Changement de statut de blessure',
      format('Le statut de la blessure de %s (%s) est maintenant: %s', 
        v_player_name,
        NEW.injury_type,
        v_status_label
      )
    );
  END IF;

  RETURN NEW;
END;
$$;