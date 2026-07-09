-- Migration 029 : résumé de match + notifications joueurs

ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS fair_play DECIMAL(2,1) NOT NULL DEFAULT 4.0;

CREATE OR REPLACE FUNCTION public.complete_match(
  p_match_id UUID,
  p_team_a_score INT,
  p_team_b_score INT,
  p_player_stats JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_player JSONB;
  v_user_id UUID;
  v_team TEXT;
  v_goals INT;
  v_assists INT;
  v_rating DECIMAL(3,1);
  v_fair_play DECIMAL(2,1);
  v_mvp BOOLEAN;
  v_result TEXT;
  v_score TEXT;
  v_stats JSONB;
  v_xp_gain INT;
  v_new_xp INT;
  v_level INT;
  v_xp_to_next INT;
  v_old_mp INT;
  v_old_avg DECIMAL(3,1);
  v_new_avg DECIMAL(3,1);
  v_old_fp DECIMAL(3,1);
  v_new_fp DECIMAL(3,1);
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut terminer le match';
  END IF;

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'Match déjà terminé';
  END IF;

  IF p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Score invalide';
  END IF;

  v_score := p_team_a_score::text || ' - ' || p_team_b_score::text;

  UPDATE public.matches SET status = 'completed' WHERE id = p_match_id;

  FOR v_player IN SELECT * FROM jsonb_array_elements(p_player_stats)
  LOOP
    v_user_id := (v_player->>'user_id')::UUID;
    v_team := v_player->>'team';
    v_goals := GREATEST(COALESCE((v_player->>'goals')::INT, 0), 0);
    v_assists := GREATEST(COALESCE((v_player->>'assists')::INT, 0), 0);
    v_rating := LEAST(GREATEST(COALESCE((v_player->>'rating')::DECIMAL, 4.0), 1.0), 5.0);
    v_fair_play := LEAST(GREATEST(COALESCE((v_player->>'fair_play')::DECIMAL, 4.0), 1.0), 5.0);
    v_mvp := COALESCE((v_player->>'mvp')::BOOLEAN, false);

    IF v_team = 'A' THEN
      IF p_team_a_score > p_team_b_score THEN v_result := 'Victoire';
      ELSIF p_team_a_score < p_team_b_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSIF v_team = 'B' THEN
      IF p_team_b_score > p_team_a_score THEN v_result := 'Victoire';
      ELSIF p_team_b_score < p_team_a_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSE
      RAISE EXCEPTION 'Équipe invalide pour le joueur %', v_user_id;
    END IF;

    INSERT INTO public.match_results (
      match_id, user_id, title, played_at, result, score, rating, fair_play, goals, assists, mvp
    ) VALUES (
      p_match_id, v_user_id, v_match.title, v_match.date,
      v_result, v_score, v_rating, v_fair_play, v_goals, v_assists, v_mvp
    );

    SELECT stats, xp, level, xp_to_next_level
    INTO v_stats, v_new_xp, v_level, v_xp_to_next
    FROM public.profiles WHERE id = v_user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_xp_gain := 50 + v_goals * 10 + v_assists * 5 + CASE WHEN v_mvp THEN 25 ELSE 0 END;
    v_new_xp := v_new_xp + v_xp_gain;

    WHILE v_new_xp >= v_xp_to_next LOOP
      v_new_xp := v_new_xp - v_xp_to_next;
      v_level := v_level + 1;
      v_xp_to_next := 1000 + (v_level - 1) * 200;
    END LOOP;

    v_old_mp := COALESCE((v_stats->>'matchesPlayed')::INT, 0);
    v_old_avg := COALESCE((v_stats->>'averageRating')::DECIMAL, 4.0);
    v_new_avg := ROUND((v_old_avg * v_old_mp + v_rating) / (v_old_mp + 1), 1);

    v_old_fp := COALESCE(
      (v_stats->>'averageFairPlay')::DECIMAL,
      COALESCE((v_stats->>'fairPlayScore')::DECIMAL, 80) / 20.0,
      4.0
    );
    v_new_fp := ROUND((v_old_fp * v_old_mp + v_fair_play) / (v_old_mp + 1), 1);

    v_stats := jsonb_set(v_stats, '{matchesPlayed}', to_jsonb(v_old_mp + 1));
    v_stats := jsonb_set(v_stats, '{goals}', to_jsonb(COALESCE((v_stats->>'goals')::INT, 0) + v_goals));
    v_stats := jsonb_set(v_stats, '{assists}', to_jsonb(COALESCE((v_stats->>'assists')::INT, 0) + v_assists));
    v_stats := jsonb_set(v_stats, '{averageRating}', to_jsonb(v_new_avg));
    v_stats := jsonb_set(v_stats, '{averageFairPlay}', to_jsonb(v_new_fp));
    v_stats := jsonb_set(v_stats, '{fairPlayScore}', to_jsonb(ROUND(v_new_fp * 20)::int));

    IF v_result = 'Victoire' THEN
      v_stats := jsonb_set(v_stats, '{wins}', to_jsonb(COALESCE((v_stats->>'wins')::INT, 0) + 1));
    ELSIF v_result = 'Défaite' THEN
      v_stats := jsonb_set(v_stats, '{losses}', to_jsonb(COALESCE((v_stats->>'losses')::INT, 0) + 1));
    ELSE
      v_stats := jsonb_set(v_stats, '{draws}', to_jsonb(COALESCE((v_stats->>'draws')::INT, 0) + 1));
    END IF;

    IF v_mvp THEN
      v_stats := jsonb_set(v_stats, '{mvpCount}', to_jsonb(COALESCE((v_stats->>'mvpCount')::INT, 0) + 1));
    END IF;

    UPDATE public.profiles
    SET stats = v_stats,
        xp = v_new_xp,
        level = v_level,
        xp_to_next_level = v_xp_to_next,
        rating = v_new_avg
    WHERE id = v_user_id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_user_id,
      'match_recap',
      'Résumé du match disponible',
      '« ' || v_match.title || ' » — Score : ' || v_score || '. Consulte buteurs, passes et composition.',
      jsonb_build_object('matchId', p_match_id::text, 'recap', 'true')
    );
  END LOOP;
END;
$$;

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
