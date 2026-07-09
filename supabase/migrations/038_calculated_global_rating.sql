-- Note globale calculée automatiquement à la finalisation (plus de rating: 4 en dur)

CREATE OR REPLACE FUNCTION public.compute_match_global_rating(
  p_result TEXT,
  p_goals INT,
  p_assists INT,
  p_mvp BOOLEAN,
  p_def_rating DECIMAL,
  p_fair_play DECIMAL
)
RETURNS DECIMAL(3,1)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(LEAST(5.0, GREATEST(1.0,
    3.0
    + CASE p_result
        WHEN 'Victoire' THEN 0.20
        WHEN 'Défaite' THEN -0.15
        ELSE 0
      END
    + LEAST(GREATEST(COALESCE(p_goals, 0), 0) * 0.25, 0.75)
    + LEAST(GREATEST(COALESCE(p_assists, 0), 0) * 0.15, 0.45)
    + CASE WHEN COALESCE(p_mvp, false) THEN 0.35 ELSE 0 END
    + (LEAST(GREATEST(COALESCE(p_def_rating, 3.0), 1.0), 5.0) - 3.0) * 0.20
    + (LEAST(GREATEST(COALESCE(p_fair_play, 4.0), 1.0), 5.0) - 4.0) * 0.15
  ))::DECIMAL, 1);
$$;

CREATE OR REPLACE FUNCTION public.finalize_match_stats(
  p_match_id UUID,
  p_player_stats JSONB,
  p_mvp_user_id UUID DEFAULT NULL
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
  v_def_rating DECIMAL(2,1);
  v_mvp BOOLEAN;
  v_mvp_user UUID;
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
  v_old_def DECIMAL(3,1);
  v_new_def DECIMAL(3,1);
  v_goals_a INT := 0;
  v_goals_b INT := 0;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut finaliser le match';
  END IF;

  IF v_match.status != 'pending_stats' THEN
    RAISE EXCEPTION 'Le match n''est pas en phase de saisie des stats';
  END IF;

  IF v_match.team_a_score IS NULL OR v_match.team_b_score IS NULL THEN
    RAISE EXCEPTION 'Score final manquant';
  END IF;

  v_score := v_match.team_a_score::text || ' - ' || v_match.team_b_score::text;

  FOR v_player IN SELECT * FROM jsonb_array_elements(p_player_stats)
  LOOP
    v_user_id := (v_player->>'user_id')::UUID;
    v_team := v_player->>'team';
    v_goals := GREATEST(COALESCE((v_player->>'goals')::INT, 0), 0);
    v_assists := GREATEST(COALESCE((v_player->>'assists')::INT, 0), 0);

    IF v_team = 'A' THEN v_goals_a := v_goals_a + v_goals;
    ELSIF v_team = 'B' THEN v_goals_b := v_goals_b + v_goals;
    ELSE RAISE EXCEPTION 'Équipe invalide pour le joueur %', v_user_id;
    END IF;
  END LOOP;

  IF v_goals_a != v_match.team_a_score OR v_goals_b != v_match.team_b_score THEN
    RAISE EXCEPTION 'Les buts par joueur (A:% / B:%) ne correspondent pas au score (A:% - B:%)',
      v_goals_a, v_goals_b, v_match.team_a_score, v_match.team_b_score;
  END IF;

  IF p_mvp_user_id IS NOT NULL THEN
    v_mvp_user := p_mvp_user_id;
  ELSE
    SELECT voted_for_id INTO v_mvp_user
    FROM public.match_mvp_votes
    WHERE match_id = p_match_id
    GROUP BY voted_for_id
    ORDER BY COUNT(*) DESC, voted_for_id
    LIMIT 1;
  END IF;

  UPDATE public.matches SET status = 'completed' WHERE id = p_match_id;

  FOR v_player IN SELECT * FROM jsonb_array_elements(p_player_stats)
  LOOP
    v_user_id := (v_player->>'user_id')::UUID;
    v_team := v_player->>'team';
    v_goals := GREATEST(COALESCE((v_player->>'goals')::INT, 0), 0);
    v_assists := GREATEST(COALESCE((v_player->>'assists')::INT, 0), 0);
    v_fair_play := LEAST(GREATEST(COALESCE((v_player->>'fair_play')::DECIMAL, 4.0), 1.0), 5.0);
    v_def_rating := LEAST(GREATEST(COALESCE((v_player->>'def_rating')::DECIMAL, 3.0), 1.0), 5.0);
    v_mvp := v_mvp_user IS NOT NULL AND v_user_id = v_mvp_user;

    IF v_team = 'A' THEN
      IF v_match.team_a_score > v_match.team_b_score THEN v_result := 'Victoire';
      ELSIF v_match.team_a_score < v_match.team_b_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSIF v_team = 'B' THEN
      IF v_match.team_b_score > v_match.team_a_score THEN v_result := 'Victoire';
      ELSIF v_match.team_b_score < v_match.team_a_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSE
      RAISE EXCEPTION 'Équipe invalide pour le joueur %', v_user_id;
    END IF;

    v_rating := public.compute_match_global_rating(
      v_result, v_goals, v_assists, v_mvp, v_def_rating, v_fair_play
    );

    INSERT INTO public.match_results (
      match_id, user_id, title, played_at, result, score, rating, fair_play, def_rating, goals, assists, mvp
    ) VALUES (
      p_match_id, v_user_id, v_match.title, v_match.date,
      v_result, v_score, v_rating, v_fair_play, v_def_rating, v_goals, v_assists, v_mvp
    );

    SELECT stats, xp, level, xp_to_next_level
    INTO v_stats, v_new_xp, v_level, v_xp_to_next
    FROM public.profiles WHERE id = v_user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_xp_gain := 50
      + v_goals * 10
      + v_assists * 5
      + CASE WHEN v_mvp THEN 25 ELSE 0 END
      + GREATEST(0, ROUND((v_def_rating - 3.0) * 5)::INT);
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

    v_old_def := COALESCE((v_stats->>'averageDefensiveRating')::DECIMAL, 3.0);
    v_new_def := ROUND((v_old_def * v_old_mp + v_def_rating) / (v_old_mp + 1), 1);

    v_stats := jsonb_set(v_stats, '{matchesPlayed}', to_jsonb(v_old_mp + 1));
    v_stats := jsonb_set(v_stats, '{goals}', to_jsonb(COALESCE((v_stats->>'goals')::INT, 0) + v_goals));
    v_stats := jsonb_set(v_stats, '{assists}', to_jsonb(COALESCE((v_stats->>'assists')::INT, 0) + v_assists));
    v_stats := jsonb_set(v_stats, '{averageRating}', to_jsonb(v_new_avg));
    v_stats := jsonb_set(v_stats, '{averageFairPlay}', to_jsonb(v_new_fp));
    v_stats := jsonb_set(v_stats, '{fairPlayScore}', to_jsonb(ROUND(v_new_fp * 20)::int));
    v_stats := jsonb_set(v_stats, '{averageDefensiveRating}', to_jsonb(v_new_def));

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

GRANT EXECUTE ON FUNCTION public.compute_match_global_rating(TEXT, INT, INT, BOOLEAN, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_match_stats(UUID, JSONB, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
