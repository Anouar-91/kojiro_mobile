-- Migration 048 : note globale /5 saisie et ajustable (joueur → capitaine → orga)

ALTER TABLE public.match_stat_entries
  ADD COLUMN IF NOT EXISTS self_global_rating DECIMAL(2,1),
  ADD COLUMN IF NOT EXISTS captain_global_rating DECIMAL(2,1);

CREATE OR REPLACE FUNCTION public.compute_match_xp_gain(
  p_rating DECIMAL,
  p_mvp BOOLEAN DEFAULT false
)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    0,
    50
      + ROUND((LEAST(GREATEST(COALESCE(p_rating, 3.0), 1.0), 5.0) - 3.0) * 15)::INT
      + CASE WHEN COALESCE(p_mvp, false) THEN 25 ELSE 0 END
  );
$$;

DROP FUNCTION IF EXISTS public.submit_my_match_stats(UUID, INT, INT, UUID, UUID, DECIMAL, DECIMAL);

CREATE OR REPLACE FUNCTION public.submit_my_match_stats(
  p_match_id UUID,
  p_goals INT,
  p_assists INT,
  p_mvp_user_id UUID DEFAULT NULL,
  p_mvp_attendee_id UUID DEFAULT NULL,
  p_global_rating DECIMAL DEFAULT 3.0,
  p_def_rating DECIMAL DEFAULT 3.0,
  p_fair_play DECIMAL DEFAULT 4.0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_global_rating DECIMAL(2,1);
  v_def_rating DECIMAL(2,1);
  v_fair_play DECIMAL(2,1);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = p_match_id AND status = 'pending_stats'
  ) THEN
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

  v_global_rating := LEAST(GREATEST(COALESCE(p_global_rating, 3.0), 1.0), 5.0);
  v_def_rating := LEAST(GREATEST(COALESCE(p_def_rating, 3.0), 1.0), 5.0);
  v_fair_play := LEAST(GREATEST(COALESCE(p_fair_play, 4.0), 1.0), 5.0);

  UPDATE public.match_stat_entries
  SET
    self_goals = GREATEST(p_goals, 0),
    self_assists = GREATEST(p_assists, 0),
    self_global_rating = v_global_rating,
    self_def_rating = v_def_rating,
    self_fair_play = v_fair_play,
    self_submitted_at = now()
  WHERE match_id = p_match_id AND user_id = auth.uid();

  IF p_mvp_user_id IS NOT NULL OR p_mvp_attendee_id IS NOT NULL THEN
    PERFORM public.record_mvp_vote(p_match_id, auth.uid(), p_mvp_user_id, p_mvp_attendee_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.captain_save_team_stats(
  p_match_id UUID,
  p_team_side TEXT,
  p_players JSONB,
  p_mvp_user_id UUID DEFAULT NULL,
  p_mvp_attendee_id UUID DEFAULT NULL
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
  v_global_rating DECIMAL(2,1);
  v_def_rating DECIMAL(2,1);
  v_fair_play DECIMAL(2,1);
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
    v_global_rating := LEAST(GREATEST(COALESCE((v_player->>'global_rating')::DECIMAL, 3.0), 1.0), 5.0);
    v_def_rating := LEAST(GREATEST(COALESCE((v_player->>'def_rating')::DECIMAL, 3.0), 1.0), 5.0);
    v_fair_play := LEAST(GREATEST(COALESCE((v_player->>'fair_play')::DECIMAL, 4.0), 1.0), 5.0);

    IF v_user_id IS NOT NULL THEN
      UPDATE public.match_stat_entries
      SET
        captain_goals = v_goals,
        captain_assists = v_assists,
        captain_global_rating = v_global_rating,
        captain_def_rating = v_def_rating,
        captain_fair_play = v_fair_play,
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
        captain_global_rating = v_global_rating,
        captain_def_rating = v_def_rating,
        captain_fair_play = v_fair_play,
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

  IF p_mvp_user_id IS NOT NULL OR p_mvp_attendee_id IS NOT NULL THEN
    PERFORM public.record_mvp_vote(p_match_id, auth.uid(), p_mvp_user_id, p_mvp_attendee_id);
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
      'selfGlobalRating', mse.self_global_rating,
      'selfDefRating', mse.self_def_rating,
      'selfFairPlay', mse.self_fair_play,
      'selfSubmittedAt', mse.self_submitted_at,
      'captainGoals', mse.captain_goals,
      'captainAssists', mse.captain_assists,
      'captainGlobalRating', mse.captain_global_rating,
      'captainDefRating', mse.captain_def_rating,
      'captainFairPlay', mse.captain_fair_play,
      'captainUpdatedAt', mse.captain_updated_at,
      'proposedGoals', COALESCE(mse.captain_goals, mse.self_goals, 0),
      'proposedAssists', COALESCE(mse.captain_assists, mse.self_assists, 0),
      'proposedGlobalRating', COALESCE(mse.captain_global_rating, mse.self_global_rating, 3.0),
      'proposedDefRating', COALESCE(mse.captain_def_rating, mse.self_def_rating, 3.0),
      'proposedFairPlay', COALESCE(mse.captain_fair_play, mse.self_fair_play, 4.0),
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
    jsonb_build_object(
      'voterId', mmv.voter_id,
      'votedForId', mmv.voted_for_id,
      'votedForAttendeeId', mmv.voted_for_attendee_id
    )
  ), '[]'::jsonb)
  INTO v_mvp_votes
  FROM public.match_mvp_votes mmv
  WHERE mmv.match_id = p_match_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'userId', voted_for_id,
      'attendeeId', voted_for_attendee_id,
      'votes', vote_count
    )
    ORDER BY vote_count DESC
  ), '[]'::jsonb)
  INTO v_mvp_tally
  FROM (
    SELECT voted_for_id, voted_for_attendee_id, COUNT(*)::INT AS vote_count
    FROM public.match_mvp_votes
    WHERE match_id = p_match_id
    GROUP BY voted_for_id, voted_for_attendee_id
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
  p_mvp_user_id UUID DEFAULT NULL,
  p_mvp_attendee_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_player JSONB;
  v_user_id UUID;
  v_attendee_id UUID;
  v_team TEXT;
  v_goals INT;
  v_assists INT;
  v_rating DECIMAL(3,1);
  v_fair_play DECIMAL(2,1);
  v_def_rating DECIMAL(2,1);
  v_mvp BOOLEAN;
  v_mvp_user UUID;
  v_mvp_attendee UUID;
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
    v_user_id := NULLIF(v_player->>'user_id', '')::UUID;
    v_attendee_id := NULLIF(v_player->>'attendee_id', '')::UUID;
    v_team := v_player->>'team';
    v_goals := GREATEST(COALESCE((v_player->>'goals')::INT, 0), 0);
    v_assists := GREATEST(COALESCE((v_player->>'assists')::INT, 0), 0);

    IF (v_user_id IS NULL AND v_attendee_id IS NULL)
      OR (v_user_id IS NOT NULL AND v_attendee_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Joueur invalide dans les stats finalisées';
    END IF;

    IF v_team = 'A' THEN v_goals_a := v_goals_a + v_goals;
    ELSIF v_team = 'B' THEN v_goals_b := v_goals_b + v_goals;
    ELSE RAISE EXCEPTION 'Équipe invalide pour le joueur';
    END IF;
  END LOOP;

  IF v_goals_a != v_match.team_a_score OR v_goals_b != v_match.team_b_score THEN
    RAISE EXCEPTION 'Les buts par joueur (A:% / B:%) ne correspondent pas au score (A:% - B:%)',
      v_goals_a, v_goals_b, v_match.team_a_score, v_match.team_b_score;
  END IF;

  v_mvp_user := p_mvp_user_id;
  v_mvp_attendee := p_mvp_attendee_id;

  IF v_mvp_user IS NULL AND v_mvp_attendee IS NULL THEN
    SELECT voted_for_id, voted_for_attendee_id
    INTO v_mvp_user, v_mvp_attendee
    FROM public.match_mvp_votes
    WHERE match_id = p_match_id
    GROUP BY voted_for_id, voted_for_attendee_id
    ORDER BY COUNT(*) DESC, voted_for_id, voted_for_attendee_id
    LIMIT 1;
  END IF;

  UPDATE public.matches SET status = 'completed' WHERE id = p_match_id;

  FOR v_player IN SELECT * FROM jsonb_array_elements(p_player_stats)
  LOOP
    v_user_id := NULLIF(v_player->>'user_id', '')::UUID;
    v_attendee_id := NULLIF(v_player->>'attendee_id', '')::UUID;
    v_team := v_player->>'team';
    v_goals := GREATEST(COALESCE((v_player->>'goals')::INT, 0), 0);
    v_assists := GREATEST(COALESCE((v_player->>'assists')::INT, 0), 0);
    v_fair_play := LEAST(GREATEST(COALESCE((v_player->>'fair_play')::DECIMAL, 4.0), 1.0), 5.0);
    v_def_rating := LEAST(GREATEST(COALESCE((v_player->>'def_rating')::DECIMAL, 3.0), 1.0), 5.0);
    v_rating := LEAST(GREATEST(COALESCE((v_player->>'global_rating')::DECIMAL, 3.0), 1.0), 5.0);
    v_mvp := (v_user_id IS NOT NULL AND v_mvp_user IS NOT NULL AND v_user_id = v_mvp_user)
      OR (v_attendee_id IS NOT NULL AND v_mvp_attendee IS NOT NULL AND v_attendee_id = v_mvp_attendee);

    IF v_team = 'A' THEN
      IF v_match.team_a_score > v_match.team_b_score THEN v_result := 'Victoire';
      ELSIF v_match.team_a_score < v_match.team_b_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSIF v_team = 'B' THEN
      IF v_match.team_b_score > v_match.team_a_score THEN v_result := 'Victoire';
      ELSIF v_match.team_b_score < v_match.team_a_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSE RAISE EXCEPTION 'Équipe invalide pour le joueur';
    END IF;

    INSERT INTO public.match_results (
      match_id, user_id, attendee_id, title, played_at, result, score, rating, fair_play, def_rating, goals, assists, mvp
    ) VALUES (
      p_match_id, v_user_id, v_attendee_id, v_match.title, v_match.date,
      v_result, v_score, v_rating, v_fair_play, v_def_rating, v_goals, v_assists, v_mvp
    );

    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT stats, xp, level, xp_to_next_level
    INTO v_stats, v_new_xp, v_level, v_xp_to_next
    FROM public.profiles WHERE id = v_user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_xp_gain := public.compute_match_xp_gain(v_rating, v_mvp);
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

CREATE OR REPLACE FUNCTION public.reopen_match_stats(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_row RECORD;
  v_attendee RECORD;
  v_stats JSONB;
  v_new_xp INT;
  v_level INT;
  v_xp_to_next INT;
  v_xp_gain INT;
  v_old_mp INT;
  v_old_avg DECIMAL(3,1);
  v_new_avg DECIMAL(3,1);
  v_old_fp DECIMAL(3,1);
  v_new_fp DECIMAL(3,1);
  v_old_def DECIMAL(3,1);
  v_new_def DECIMAL(3,1);
  v_mvp_user UUID;
  v_mvp_attendee UUID;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut rouvrir la saisie des stats';
  END IF;

  IF v_match.status != 'completed' THEN
    RAISE EXCEPTION 'Seuls les matchs terminés peuvent être rouverts';
  END IF;

  v_mvp_user := NULL;
  v_mvp_attendee := NULL;

  FOR v_row IN
    SELECT *
    FROM public.match_results
    WHERE match_id = p_match_id
  LOOP
    IF v_row.user_id IS NOT NULL THEN
      UPDATE public.match_stat_entries
      SET
        self_goals = v_row.goals,
        self_assists = v_row.assists,
        self_global_rating = COALESCE(v_row.rating, 3.0),
        self_def_rating = COALESCE(v_row.def_rating, 3.0),
        self_fair_play = COALESCE(v_row.fair_play, 4.0),
        captain_goals = v_row.goals,
        captain_assists = v_row.assists,
        captain_global_rating = COALESCE(v_row.rating, 3.0),
        captain_def_rating = COALESCE(v_row.def_rating, 3.0),
        captain_fair_play = COALESCE(v_row.fair_play, 4.0),
        captain_updated_at = now(),
        captain_updated_by = auth.uid()
      WHERE match_id = p_match_id
        AND user_id = v_row.user_id;
    ELSIF v_row.attendee_id IS NOT NULL THEN
      UPDATE public.match_stat_entries
      SET
        captain_goals = v_row.goals,
        captain_assists = v_row.assists,
        captain_global_rating = COALESCE(v_row.rating, 3.0),
        captain_def_rating = COALESCE(v_row.def_rating, 3.0),
        captain_fair_play = COALESCE(v_row.fair_play, 4.0),
        captain_updated_at = now(),
        captain_updated_by = auth.uid()
      WHERE match_id = p_match_id
        AND attendee_id = v_row.attendee_id;
    END IF;

    IF v_row.mvp THEN
      v_mvp_user := v_row.user_id;
      v_mvp_attendee := v_row.attendee_id;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT *
    FROM public.match_results
    WHERE match_id = p_match_id
      AND user_id IS NOT NULL
  LOOP
    SELECT stats, xp, level, xp_to_next_level
    INTO v_stats, v_new_xp, v_level, v_xp_to_next
    FROM public.profiles
    WHERE id = v_row.user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_xp_gain := public.compute_match_xp_gain(v_row.rating, v_row.mvp);
    v_new_xp := v_new_xp - v_xp_gain;

    WHILE v_level > 1 AND v_new_xp < 0 LOOP
      v_level := v_level - 1;
      v_xp_to_next := 1000 + (v_level - 1) * 200;
      v_new_xp := v_new_xp + v_xp_to_next;
    END LOOP;

    IF v_new_xp < 0 THEN
      v_new_xp := 0;
    END IF;

    v_old_mp := COALESCE((v_stats->>'matchesPlayed')::INT, 0);
    IF v_old_mp <= 1 THEN
      v_new_avg := 4.0;
      v_new_fp := 4.0;
      v_new_def := 3.0;
    ELSE
      v_old_avg := COALESCE((v_stats->>'averageRating')::DECIMAL, 4.0);
      v_new_avg := ROUND((v_old_avg * v_old_mp - v_row.rating) / (v_old_mp - 1), 1);

      v_old_fp := COALESCE(
        (v_stats->>'averageFairPlay')::DECIMAL,
        COALESCE((v_stats->>'fairPlayScore')::DECIMAL, 80) / 20.0,
        4.0
      );
      v_new_fp := ROUND((v_old_fp * v_old_mp - COALESCE(v_row.fair_play, 4.0)) / (v_old_mp - 1), 1);

      v_old_def := COALESCE((v_stats->>'averageDefensiveRating')::DECIMAL, 3.0);
      v_new_def := ROUND((v_old_def * v_old_mp - COALESCE(v_row.def_rating, 3.0)) / (v_old_mp - 1), 1);
    END IF;

    v_stats := jsonb_set(v_stats, '{matchesPlayed}', to_jsonb(GREATEST(v_old_mp - 1, 0)));
    v_stats := jsonb_set(v_stats, '{goals}', to_jsonb(GREATEST(COALESCE((v_stats->>'goals')::INT, 0) - v_row.goals, 0)));
    v_stats := jsonb_set(v_stats, '{assists}', to_jsonb(GREATEST(COALESCE((v_stats->>'assists')::INT, 0) - v_row.assists, 0)));
    v_stats := jsonb_set(v_stats, '{averageRating}', to_jsonb(v_new_avg));
    v_stats := jsonb_set(v_stats, '{averageFairPlay}', to_jsonb(v_new_fp));
    v_stats := jsonb_set(v_stats, '{fairPlayScore}', to_jsonb(ROUND(v_new_fp * 20)::int));
    v_stats := jsonb_set(v_stats, '{averageDefensiveRating}', to_jsonb(v_new_def));

    IF v_row.result = 'Victoire' THEN
      v_stats := jsonb_set(v_stats, '{wins}', to_jsonb(GREATEST(COALESCE((v_stats->>'wins')::INT, 0) - 1, 0)));
    ELSIF v_row.result = 'Défaite' THEN
      v_stats := jsonb_set(v_stats, '{losses}', to_jsonb(GREATEST(COALESCE((v_stats->>'losses')::INT, 0) - 1, 0)));
    ELSE
      v_stats := jsonb_set(v_stats, '{draws}', to_jsonb(GREATEST(COALESCE((v_stats->>'draws')::INT, 0) - 1, 0)));
    END IF;

    IF v_row.mvp THEN
      v_stats := jsonb_set(v_stats, '{mvpCount}', to_jsonb(GREATEST(COALESCE((v_stats->>'mvpCount')::INT, 0) - 1, 0)));
    END IF;

    UPDATE public.profiles
    SET stats = v_stats,
        xp = v_new_xp,
        level = v_level,
        xp_to_next_level = v_xp_to_next,
        rating = v_new_avg
    WHERE id = v_row.user_id;
  END LOOP;

  IF v_mvp_user IS NOT NULL OR v_mvp_attendee IS NOT NULL THEN
    PERFORM public.record_mvp_vote(p_match_id, auth.uid(), v_mvp_user, v_mvp_attendee);
  END IF;

  DELETE FROM public.match_results WHERE match_id = p_match_id;

  UPDATE public.matches
  SET status = 'pending_stats'
  WHERE id = p_match_id;

  FOR v_attendee IN
    SELECT ma.user_id
    FROM public.match_attendees ma
    WHERE ma.match_id = p_match_id
      AND ma.status = 'present'
      AND ma.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_attendee.user_id,
      'match_stats',
      'Stats rouvertes',
      '« ' || v_match.title || ' » — L''organisateur a rouvert la saisie des stats pour correction. Vérifie ou mets à jour les tiennes.',
      jsonb_build_object('matchId', p_match_id::text, 'stats', 'true', 'reopened', 'true')
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_match_xp_gain(DECIMAL, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_match_stats(UUID, INT, INT, UUID, UUID, DECIMAL, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.captain_save_team_stats(UUID, TEXT, JSONB, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_stats_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_match_stats(UUID, JSONB, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_match_stats(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
