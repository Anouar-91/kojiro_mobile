-- Migration 015 : liste d'attente match + notification place libérée
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.match_attendees DROP CONSTRAINT IF EXISTS match_attendees_status_check;
ALTER TABLE public.match_attendees
  ADD CONSTRAINT match_attendees_status_check
  CHECK (status IN ('present', 'absent', 'maybe', 'pending', 'waitlist'));

CREATE OR REPLACE FUNCTION public.notify_waitlist_spot_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_present INT;
  v_waitlist_user RECORD;
  v_match_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IS DISTINCT FROM 'present' THEN
      RETURN OLD;
    END IF;
    v_match_id := OLD.match_id;
  ELSE
    IF OLD.status IS DISTINCT FROM 'present' OR NEW.status = 'present' THEN
      RETURN NEW;
    END IF;
    v_match_id := NEW.match_id;
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_match_id;
  IF NOT FOUND OR v_match.status NOT IN ('upcoming', 'live') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT COUNT(*)::INT INTO v_present
  FROM public.match_attendees
  WHERE match_id = v_match_id AND status = 'present';

  IF v_present >= v_match.max_players THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  FOR v_waitlist_user IN
    SELECT ma.user_id
    FROM public.match_attendees ma
    WHERE ma.match_id = v_match_id AND ma.status = 'waitlist'
    ORDER BY ma.created_at ASC
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_waitlist_user.user_id,
      'match_waitlist',
      'Une place s''est libérée !',
      'Un joueur s''est désisté de « ' || v_match.title || ' ». Sois le premier à confirmer ta présence pour réserver la place.',
      jsonb_build_object('matchId', v_match_id::text)
    );
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_waitlist_spot ON public.match_attendees;
CREATE TRIGGER trg_notify_waitlist_spot
  AFTER UPDATE OF status OR DELETE ON public.match_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waitlist_spot_available();

CREATE INDEX IF NOT EXISTS idx_attendees_waitlist
  ON public.match_attendees (match_id, created_at)
  WHERE status = 'waitlist';

NOTIFY pgrst, 'reload schema';
