-- Migration 016 : organisateur peut retirer un joueur de l'effectif
-- Exécuter dans Supabase SQL Editor

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

  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Ce match n''est plus modifiable';
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

GRANT EXECUTE ON FUNCTION public.organizer_remove_attendee(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
