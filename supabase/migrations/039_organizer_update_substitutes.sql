-- Migration 039 : organisateur peut augmenter les remplaçants après création du match

CREATE OR REPLACE FUNCTION public.organizer_update_substitutes(
  p_match_id UUID,
  p_substitutes_per_team INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_new_max INT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut modifier les remplaçants';
  END IF;

  IF v_match.status IN ('completed', 'cancelled', 'pending_stats') THEN
    RAISE EXCEPTION 'Ce match n''est plus modifiable';
  END IF;

  IF p_substitutes_per_team < 0 OR p_substitutes_per_team > 10 THEN
    RAISE EXCEPTION 'Le nombre de remplaçants doit être entre 0 et 10 par équipe';
  END IF;

  IF p_substitutes_per_team < v_match.substitutes_per_team THEN
    RAISE EXCEPTION 'Tu ne peux qu''augmenter le nombre de remplaçants';
  END IF;

  IF p_substitutes_per_team = v_match.substitutes_per_team THEN
    RETURN;
  END IF;

  v_new_max := (v_match.format + p_substitutes_per_team) * 2;

  UPDATE public.matches
  SET
    substitutes_per_team = p_substitutes_per_team,
    max_players = v_new_max
  WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.organizer_update_substitutes(UUID, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
