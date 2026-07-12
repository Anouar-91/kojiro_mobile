-- Migration 043 : permettre à l'organisateur de corriger le score pendant pending_stats

CREATE OR REPLACE FUNCTION public.update_match_score(
  p_match_id UUID,
  p_team_a_score INT,
  p_team_b_score INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut modifier le score';
  END IF;

  IF v_match.status != 'pending_stats' THEN
    RAISE EXCEPTION 'Le score ne peut être modifié que pendant la saisie des stats';
  END IF;

  IF p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Score invalide';
  END IF;

  IF v_match.team_a_score = p_team_a_score AND v_match.team_b_score = p_team_b_score THEN
    RETURN;
  END IF;

  UPDATE public.matches
  SET
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score
  WHERE id = p_match_id;

  DELETE FROM public.match_team_stat_validations WHERE match_id = p_match_id;
  DELETE FROM public.match_mvp_votes WHERE match_id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_match_score(UUID, INT, INT) TO authenticated;
