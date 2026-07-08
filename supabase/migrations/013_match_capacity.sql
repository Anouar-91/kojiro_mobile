-- Migration 013 : quota joueurs présents par match
-- Exécuter dans Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.enforce_match_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max INT;
  v_present INT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'present' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'present' THEN
    RETURN NEW;
  END IF;

  SELECT max_players INTO v_max
  FROM public.matches
  WHERE id = NEW.match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  SELECT COUNT(*)::INT INTO v_present
  FROM public.match_attendees
  WHERE match_id = NEW.match_id
    AND status = 'present'
    AND user_id IS DISTINCT FROM NEW.user_id;

  IF v_present >= v_max THEN
    RAISE EXCEPTION 'Ce match est complet (% places)', v_max;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_match_capacity ON public.match_attendees;
CREATE TRIGGER trg_enforce_match_capacity
  BEFORE INSERT OR UPDATE OF status ON public.match_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_match_capacity();
