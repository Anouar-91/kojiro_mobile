-- Migration 030 : fix résumé — colonne fair_play manquante sur match_results

ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS fair_play DECIMAL(2,1) NOT NULL DEFAULT 4.0;

CREATE OR REPLACE FUNCTION public.get_match_recap(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_score TEXT;
  v_team_a_score INT;
  v_team_b_score INT;
  v_players JSONB;
  v_mvp JSONB;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.status != 'completed' THEN
    RAISE EXCEPTION 'Le résumé n''est pas encore disponible';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.match_results WHERE match_id = p_match_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = p_match_id AND organizer_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT score INTO v_score
  FROM public.match_results
  WHERE match_id = p_match_id
  LIMIT 1;

  v_team_a_score := NULLIF(split_part(v_score, ' - ', 1), '')::INT;
  v_team_b_score := NULLIF(split_part(v_score, ' - ', 2), '')::INT;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'userId', mr.user_id,
      'name', p.name,
      'avatarUrl', p.avatar_url,
      'team', COALESCE(ml.team_side, 'A'),
      'goals', mr.goals,
      'assists', mr.assists,
      'rating', mr.rating,
      'fairPlay', COALESCE(mr.fair_play, 4.0),
      'mvp', mr.mvp,
      'result', mr.result
    )
    ORDER BY mr.goals DESC, mr.assists DESC, p.name
  ), '[]'::jsonb)
  INTO v_players
  FROM public.match_results mr
  JOIN public.profiles p ON p.id = mr.user_id
  LEFT JOIN public.match_lineups ml
    ON ml.match_id = mr.match_id AND ml.user_id = mr.user_id
  WHERE mr.match_id = p_match_id;

  SELECT jsonb_build_object(
    'userId', mr.user_id,
    'name', p.name
  )
  INTO v_mvp
  FROM public.match_results mr
  JOIN public.profiles p ON p.id = mr.user_id
  WHERE mr.match_id = p_match_id AND mr.mvp = true
  LIMIT 1;

  RETURN jsonb_build_object(
    'matchId', v_match.id,
    'title', v_match.title,
    'date', v_match.date,
    'locationName', v_match.location_name,
    'format', v_match.format,
    'score', v_score,
    'teamAScore', v_team_a_score,
    'teamBScore', v_team_b_score,
    'players', v_players,
    'mvp', v_mvp
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_match_recap(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
