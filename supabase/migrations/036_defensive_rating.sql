-- Migration 036 : note défensive /5 (auto-déclaration → capitaine → orga, défaut 3)

ALTER TABLE public.match_stat_entries
  ADD COLUMN IF NOT EXISTS self_def_rating DECIMAL(2,1),
  ADD COLUMN IF NOT EXISTS captain_def_rating DECIMAL(2,1);

ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS def_rating DECIMAL(2,1) NOT NULL DEFAULT 3.0;

DROP FUNCTION IF EXISTS public.submit_my_match_stats(UUID, INT, INT, UUID);

CREATE OR REPLACE FUNCTION public.submit_my_match_stats(
  p_match_id UUID,
  p_goals INT,
  p_assists INT,
  p_mvp_user_id UUID DEFAULT NULL,
  p_def_rating DECIMAL DEFAULT 3.0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_winning TEXT;
  v_mvp_team TEXT;
  v_def_rating DECIMAL(2,1);
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.status != 'pending_stats' THEN
    RAISE EXCEPTION 'La saisie des stats n''est pas ouverte';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_attendees
    WHERE match_id = p_match_id AND user_id = auth.uid() AND status = 'present'
  ) THEN
    RAISE EXCEPTION 'Tu dois être présent sur ce match';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_stat_entries
    WHERE match_id = p_match_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Tu ne fais pas partie des équipes de ce match';
  END IF;

  v_def_rating := LEAST(GREATEST(COALESCE(p_def_rating, 3.0), 1.0), 5.0);

  UPDATE public.match_stat_entries
  SET
    self_goals = GREATEST(p_goals, 0),
    self_assists = GREATEST(p_assists, 0),
    self_def_rating = v_def_rating,
    self_submitted_at = now()
  WHERE match_id = p_match_id AND user_id = auth.uid();

  IF p_mvp_user_id IS NOT NULL THEN
    IF p_mvp_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Tu ne peux pas voter pour toi-même';
    END IF;

    v_winning := public.match_winning_side(v_match.team_a_score, v_match.team_b_score);

    SELECT mse.team_side INTO v_mvp_team
    FROM public.match_stat_entries mse
    WHERE mse.match_id = p_match_id AND mse.user_id = p_mvp_user_id;

    IF v_mvp_team IS NULL THEN
      RAISE EXCEPTION 'Joueur MVP invalide';
    END IF;

    IF v_winning != 'draw' AND v_mvp_team != v_winning THEN
      RAISE EXCEPTION 'Le MVP doit être dans l''équipe gagnante';
    END IF;

    INSERT INTO public.match_mvp_votes (match_id, voter_id, voted_for_id)
    VALUES (p_match_id, auth.uid(), p_mvp_user_id)
    ON CONFLICT (match_id, voter_id)
    DO UPDATE SET voted_for_id = EXCLUDED.voted_for_id, created_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.captain_save_team_stats(
  p_match_id UUID,
  p_team_side TEXT,
  p_players JSONB,
  p_mvp_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_captain_side TEXT;
  v_player JSONB;
  v_user_id UUID;
  v_attendee_id UUID;
  v_goals INT;
  v_assists INT;
  v_def_rating DECIMAL(2,1);
  v_winning TEXT;
  v_mvp_team TEXT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.status != 'pending_stats' THEN
    RAISE EXCEPTION 'La saisie des stats n''est pas ouverte';
  END IF;

  IF p_team_side NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'Équipe invalide';
  END IF;

  v_captain_side := public.get_captain_team_side(p_match_id, auth.uid());
  IF v_captain_side IS NULL OR v_captain_side != p_team_side THEN
    IF v_match.organizer_id != auth.uid() THEN
      RAISE EXCEPTION 'Seul le capitaine de cette équipe peut valider ces stats';
    END IF;
  END IF;

  FOR v_player IN SELECT * FROM jsonb_array_elements(p_players)
  LOOP
    v_user_id := NULLIF(v_player->>'user_id', '')::UUID;
    v_attendee_id := NULLIF(v_player->>'attendee_id', '')::UUID;
    v_goals := GREATEST(COALESCE((v_player->>'goals')::INT, 0), 0);
    v_assists := GREATEST(COALESCE((v_player->>'assists')::INT, 0), 0);
    v_def_rating := LEAST(GREATEST(COALESCE((v_player->>'def_rating')::DECIMAL, 3.0), 1.0), 5.0);

    IF v_user_id IS NOT NULL THEN
      UPDATE public.match_stat_entries
      SET
        captain_goals = v_goals,
        captain_assists = v_assists,
        captain_def_rating = v_def_rating,
        captain_updated_at = now(),
        captain_updated_by = auth.uid()
      WHERE match_id = p_match_id
        AND user_id = v_user_id
        AND team_side = p_team_side;
    ELSIF v_attendee_id IS NOT NULL THEN
      UPDATE public.match_stat_entries
      SET
        captain_goals = v_goals,
        captain_assists = v_assists,
        captain_def_rating = v_def_rating,
        captain_updated_at = now(),
        captain_updated_by = auth.uid()
      WHERE match_id = p_match_id
        AND attendee_id = v_attendee_id
        AND team_side = p_team_side;
    END IF;
  END LOOP;

  IF v_captain_side = p_team_side THEN
    INSERT INTO public.match_team_stat_validations (match_id, team_side, validated_by)
    VALUES (p_match_id, p_team_side, auth.uid())
    ON CONFLICT (match_id, team_side)
    DO UPDATE SET validated_by = EXCLUDED.validated_by, validated_at = now();
  END IF;

  IF p_mvp_user_id IS NOT NULL THEN
    IF p_mvp_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Tu ne peux pas voter pour toi-même';
    END IF;

    v_winning := public.match_winning_side(v_match.team_a_score, v_match.team_b_score);

    SELECT mse.team_side INTO v_mvp_team
    FROM public.match_stat_entries mse
    WHERE mse.match_id = p_match_id AND mse.user_id = p_mvp_user_id;

    IF v_mvp_team IS NULL THEN
      RAISE EXCEPTION 'Joueur MVP invalide';
    END IF;

    IF v_winning != 'draw' AND v_mvp_team != v_winning THEN
      RAISE EXCEPTION 'Le MVP doit être dans l''équipe gagnante';
    END IF;

    INSERT INTO public.match_mvp_votes (match_id, voter_id, voted_for_id)
    VALUES (p_match_id, auth.uid(), p_mvp_user_id)
    ON CONFLICT (match_id, voter_id)
    DO UPDATE SET voted_for_id = EXCLUDED.voted_for_id, created_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_match_stats_state(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_entries JSONB;
  v_validations JSONB;
  v_mvp_votes JSONB;
  v_mvp_tally JSONB;
  v_can_access BOOLEAN;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  v_can_access := v_match.organizer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.match_attendees ma
      WHERE ma.match_id = p_match_id
        AND ma.user_id = auth.uid()
        AND ma.status = 'present'
    );

  IF NOT v_can_access THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'entryId', mse.id,
      'userId', mse.user_id,
      'attendeeId', mse.attendee_id,
      'teamSide', mse.team_side,
      'selfGoals', mse.self_goals,
      'selfAssists', mse.self_assists,
      'selfDefRating', mse.self_def_rating,
      'selfSubmittedAt', mse.self_submitted_at,
      'captainGoals', mse.captain_goals,
      'captainAssists', mse.captain_assists,
      'captainDefRating', mse.captain_def_rating,
      'captainUpdatedAt', mse.captain_updated_at,
      'proposedGoals', COALESCE(mse.captain_goals, mse.self_goals, 0),
      'proposedAssists', COALESCE(mse.captain_assists, mse.self_assists, 0),
      'proposedDefRating', COALESCE(mse.captain_def_rating, mse.self_def_rating, 3.0),
      'name', COALESCE(p.name, ma.guest_name, 'Joueur'),
      'isGuest', mse.user_id IS NULL
    )
    ORDER BY mse.team_side, COALESCE(p.name, ma.guest_name)
  ), '[]'::jsonb)
  INTO v_entries
  FROM public.match_stat_entries mse
  LEFT JOIN public.profiles p ON p.id = mse.user_id
  LEFT JOIN public.match_attendees ma ON ma.id = mse.attendee_id
  WHERE mse.match_id = p_match_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('teamSide', mtsv.team_side, 'validatedBy', mtsv.validated_by, 'validatedAt', mtsv.validated_at)
  ), '[]'::jsonb)
  INTO v_validations
  FROM public.match_team_stat_validations mtsv
  WHERE mtsv.match_id = p_match_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('voterId', mmv.voter_id, 'votedForId', mmv.voted_for_id)
  ), '[]'::jsonb)
  INTO v_mvp_votes
  FROM public.match_mvp_votes mmv
  WHERE mmv.match_id = p_match_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('userId', voted_for_id, 'votes', vote_count)
    ORDER BY vote_count DESC
  ), '[]'::jsonb)
  INTO v_mvp_tally
  FROM (
    SELECT voted_for_id, COUNT(*)::INT AS vote_count
    FROM public.match_mvp_votes
    WHERE match_id = p_match_id
    GROUP BY voted_for_id
  ) t;

  RETURN jsonb_build_object(
    'matchId', v_match.id,
    'status', v_match.status,
    'teamAScore', v_match.team_a_score,
    'teamBScore', v_match.team_b_score,
    'winningSide', public.match_winning_side(v_match.team_a_score, v_match.team_b_score),
    'statsOpenedAt', v_match.stats_opened_at,
    'organizerId', v_match.organizer_id,
    'captainAId', (SELECT captain_a_id FROM public.match_compositions WHERE match_id = p_match_id),
    'captainBId', (SELECT captain_b_id FROM public.match_compositions WHERE match_id = p_match_id),
    'entries', v_entries,
    'teamValidations', v_validations,
    'mvpVotes', v_mvp_votes,
    'mvpTally', v_mvp_tally,
    'myCaptainSide', public.get_captain_team_side(p_match_id, auth.uid())
  );
END;
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
    v_rating := LEAST(GREATEST(COALESCE((v_player->>'rating')::DECIMAL, 4.0), 1.0), 5.0);
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
      'defRating', COALESCE(mr.def_rating, 3.0),
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

GRANT EXECUTE ON FUNCTION public.submit_my_match_stats(UUID, INT, INT, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.captain_save_team_stats(UUID, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_stats_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_match_stats(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_recap(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
