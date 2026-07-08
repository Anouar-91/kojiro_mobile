-- Migration 019 : verrouillage des présences (match live / terminé / annulé)
-- Exécuter dans Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.enforce_attendance_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.matches
  WHERE id = NEW.match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_status IN ('live', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Les présences ne peuvent plus être modifiées pour ce match';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_attendance_locked ON public.match_attendees;
CREATE TRIGGER trg_enforce_attendance_locked
  BEFORE INSERT OR UPDATE OF status ON public.match_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_attendance_locked();

-- Organisateur : retrait joueur uniquement avant le coup d'envoi
CREATE OR REPLACE FUNCTION public.organizer_remove_attendee(
  p_match_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_player_name TEXT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut retirer un joueur';
  END IF;

  IF v_match.status != 'upcoming' THEN
    RAISE EXCEPTION 'L''effectif ne peut plus être modifié une fois le match lancé';
  END IF;

  IF p_user_id = v_match.organizer_id THEN
    RAISE EXCEPTION 'Tu ne peux pas te retirer toi-même du match';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_attendees
    WHERE match_id = p_match_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Ce joueur ne fait pas partie du match';
  END IF;

  SELECT name INTO v_player_name FROM public.profiles WHERE id = p_user_id;

  DELETE FROM public.match_lineups
  WHERE match_id = p_match_id AND user_id = p_user_id;

  DELETE FROM public.match_attendees
  WHERE match_id = p_match_id AND user_id = p_user_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_user_id,
    'match_reminder',
    'Retiré du match',
    'L''organisateur t''a retiré de « ' || v_match.title || ' ».',
    jsonb_build_object('matchId', p_match_id::text)
  );
END;
$$;

-- Invitations : uniquement tant que le match n'a pas démarré
CREATE OR REPLACE FUNCTION public.invite_to_match(p_match_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_inviter_name TEXT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut inviter';
  END IF;

  IF v_match.status != 'upcoming' THEN
    RAISE EXCEPTION 'Ce match n''accepte plus d''invitations';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Tu ne peux pas t''inviter toi-même';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Joueur introuvable';
  END IF;

  SELECT name INTO v_inviter_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.match_attendees (match_id, user_id, status)
  VALUES (p_match_id, p_user_id, 'pending')
  ON CONFLICT (match_id, user_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_user_id,
    'match_invite',
    'Invitation au match',
    v_inviter_name || ' t''invite à « ' || v_match.title || ' ».',
    jsonb_build_object('matchId', p_match_id::text)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
