-- Migration 056 : annuler un match / clôturer sans stats détaillées

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS completed_without_stats BOOLEAN NOT NULL DEFAULT false;

-- ─── Annuler le match ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_attendee RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut annuler le match';
  END IF;

  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Ce match est déjà terminé ou annulé';
  END IF;

  DELETE FROM public.match_mvp_votes WHERE match_id = p_match_id;
  DELETE FROM public.match_team_stat_validations WHERE match_id = p_match_id;
  DELETE FROM public.match_stat_entries WHERE match_id = p_match_id;

  UPDATE public.matches
  SET
    status = 'cancelled',
    completed_without_stats = false,
    team_a_score = NULL,
    team_b_score = NULL
  WHERE id = p_match_id;

  FOR v_attendee IN
    SELECT ma.user_id
    FROM public.match_attendees ma
    WHERE ma.match_id = p_match_id
      AND ma.user_id IS NOT NULL
      AND ma.status IN ('present', 'maybe', 'pending', 'waitlist')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_attendee.user_id,
      'match_cancelled',
      'Match annulé',
      '« ' || v_match.title || ' » a été annulé par l''organisateur.',
      jsonb_build_object('matchId', p_match_id::text, 'cancelled', 'true')
    );
  END LOOP;
END;
$$;

-- ─── Clôturer sans saisie collaborative ───────────────────────
CREATE OR REPLACE FUNCTION public.close_match_simple(
  p_match_id UUID,
  p_team_a_score INT DEFAULT NULL,
  p_team_b_score INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_attendee RECORD;
  v_team TEXT;
  v_result TEXT;
  v_score TEXT;
  v_has_score BOOLEAN;
  v_stats JSONB;
  v_old_mp INT;
  v_new_xp INT;
  v_level INT;
  v_xp_to_next INT;
  v_xp_gain CONSTANT INT := 25; -- participation (moitié de la base stats)
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut clôturer le match';
  END IF;

  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Ce match est déjà terminé ou annulé';
  END IF;

  IF (p_team_a_score IS NULL) <> (p_team_b_score IS NULL) THEN
    RAISE EXCEPTION 'Indique les deux scores, ou aucun';
  END IF;

  IF p_team_a_score IS NOT NULL AND (p_team_a_score < 0 OR p_team_b_score < 0) THEN
    RAISE EXCEPTION 'Score invalide';
  END IF;

  v_has_score := p_team_a_score IS NOT NULL;
  IF v_has_score THEN
    v_score := p_team_a_score::text || ' - ' || p_team_b_score::text;
  ELSE
    v_score := '–';
  END IF;

  DELETE FROM public.match_mvp_votes WHERE match_id = p_match_id;
  DELETE FROM public.match_team_stat_validations WHERE match_id = p_match_id;
  DELETE FROM public.match_stat_entries WHERE match_id = p_match_id;
  DELETE FROM public.match_results WHERE match_id = p_match_id;

  UPDATE public.matches
  SET
    status = 'completed',
    completed_without_stats = true,
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score
  WHERE id = p_match_id;

  FOR v_attendee IN
    SELECT ma.id, ma.user_id, ma.guest_name
    FROM public.match_attendees ma
    WHERE ma.match_id = p_match_id
      AND ma.status = 'present'
  LOOP
    SELECT ml.team_side INTO v_team
    FROM public.match_lineups ml
    WHERE ml.match_id = p_match_id
      AND (
        (v_attendee.user_id IS NOT NULL AND ml.user_id = v_attendee.user_id)
        OR (v_attendee.user_id IS NULL AND ml.attendee_id = v_attendee.id)
      )
    LIMIT 1;

    IF v_has_score AND v_team = 'A' THEN
      IF p_team_a_score > p_team_b_score THEN v_result := 'Victoire';
      ELSIF p_team_a_score < p_team_b_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSIF v_has_score AND v_team = 'B' THEN
      IF p_team_b_score > p_team_a_score THEN v_result := 'Victoire';
      ELSIF p_team_b_score < p_team_a_score THEN v_result := 'Défaite';
      ELSE v_result := 'Nul'; END IF;
    ELSE
      v_result := 'Nul';
    END IF;

    INSERT INTO public.match_results (
      match_id, user_id, attendee_id, title, played_at, result, score,
      rating, fair_play, def_rating, goals, assists, mvp
    ) VALUES (
      p_match_id,
      v_attendee.user_id,
      CASE WHEN v_attendee.user_id IS NULL THEN v_attendee.id ELSE NULL END,
      v_match.title,
      v_match.date,
      v_result,
      v_score,
      3.0,
      4.0,
      3.0,
      0,
      0,
      false
    );

    -- Profil : match joué + W/L/D + XP participation (sans moyennes de notes)
    IF v_attendee.user_id IS NOT NULL THEN
      SELECT stats, xp, level, xp_to_next_level
      INTO v_stats, v_new_xp, v_level, v_xp_to_next
      FROM public.profiles
      WHERE id = v_attendee.user_id;

      IF FOUND THEN
        v_old_mp := COALESCE((v_stats->>'matchesPlayed')::INT, 0);
        v_stats := jsonb_set(v_stats, '{matchesPlayed}', to_jsonb(v_old_mp + 1));
        IF v_has_score AND v_team IN ('A', 'B') THEN
          IF v_result = 'Victoire' THEN
            v_stats := jsonb_set(v_stats, '{wins}', to_jsonb(COALESCE((v_stats->>'wins')::INT, 0) + 1));
          ELSIF v_result = 'Défaite' THEN
            v_stats := jsonb_set(v_stats, '{losses}', to_jsonb(COALESCE((v_stats->>'losses')::INT, 0) + 1));
          ELSE
            v_stats := jsonb_set(v_stats, '{draws}', to_jsonb(COALESCE((v_stats->>'draws')::INT, 0) + 1));
          END IF;
        ELSE
          v_stats := jsonb_set(v_stats, '{draws}', to_jsonb(COALESCE((v_stats->>'draws')::INT, 0) + 1));
        END IF;

        v_new_xp := v_new_xp + v_xp_gain;
        WHILE v_new_xp >= v_xp_to_next LOOP
          v_new_xp := v_new_xp - v_xp_to_next;
          v_level := v_level + 1;
          v_xp_to_next := 1000 + (v_level - 1) * 200;
        END LOOP;

        UPDATE public.profiles
        SET
          stats = v_stats,
          xp = v_new_xp,
          level = v_level,
          xp_to_next_level = v_xp_to_next
        WHERE id = v_attendee.user_id;
      END IF;

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_attendee.user_id,
        'match_recap',
        'Match clôturé',
        CASE
          WHEN v_has_score THEN
            '« ' || v_match.title || ' » est terminé (' || v_score || '). +25 XP — pas de stats détaillées.'
          ELSE
            '« ' || v_match.title || ' » a été clôturé sans stats. +25 XP de participation.'
        END,
        jsonb_build_object(
          'matchId', p_match_id::text,
          'recap', 'true',
          'simple', 'true'
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- ─── Bloquer la réouverture des clôtures simples ─────────────
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

  IF COALESCE(v_match.completed_without_stats, false) THEN
    RAISE EXCEPTION 'Ce match a été clôturé sans stats détaillées et ne peut pas être rouvert';
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
  SET status = 'pending_stats',
      completed_without_stats = false
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

-- ─── Résumé : scores non numériques (clôture sans score) ──────
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

  v_team_a_score := v_match.team_a_score;
  v_team_b_score := v_match.team_b_score;

  IF v_score IS NULL AND v_team_a_score IS NOT NULL AND v_team_b_score IS NOT NULL THEN
    v_score := v_team_a_score::text || ' - ' || v_team_b_score::text;
  END IF;

  IF v_team_a_score IS NULL
     AND v_score IS NOT NULL
     AND v_score ~ '^[0-9]+[[:space:]]*-[[:space:]]*[0-9]+$' THEN
    v_team_a_score := NULLIF(trim(split_part(v_score, '-', 1)), '')::INT;
    v_team_b_score := NULLIF(trim(split_part(v_score, '-', 2)), '')::INT;
  END IF;

  v_score := COALESCE(v_score, '–');

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'userId', CASE
        WHEN mr.user_id IS NOT NULL THEN mr.user_id::text
        ELSE 'guest:' || mr.attendee_id::text
      END,
      'name', COALESCE(p.name, ma.guest_name, 'Joueur'),
      'avatarUrl', p.avatar_url,
      'team', COALESCE(ml.team_side, mse.team_side, 'A'),
      'goals', mr.goals,
      'assists', mr.assists,
      'rating', mr.rating,
      'fairPlay', COALESCE(mr.fair_play, 4.0),
      'defRating', COALESCE(mr.def_rating, 3.0),
      'mvp', mr.mvp,
      'result', mr.result,
      'isGuest', mr.attendee_id IS NOT NULL
    )
    ORDER BY mr.goals DESC, mr.assists DESC, COALESCE(p.name, ma.guest_name)
  ), '[]'::jsonb)
  INTO v_players
  FROM public.match_results mr
  LEFT JOIN public.profiles p ON p.id = mr.user_id
  LEFT JOIN public.match_attendees ma ON ma.id = mr.attendee_id
  LEFT JOIN public.match_lineups ml
    ON ml.match_id = mr.match_id
    AND (
      (mr.user_id IS NOT NULL AND ml.user_id = mr.user_id)
      OR (mr.attendee_id IS NOT NULL AND ml.attendee_id = mr.attendee_id)
    )
  LEFT JOIN public.match_stat_entries mse
    ON mse.match_id = mr.match_id
    AND (
      (mr.user_id IS NOT NULL AND mse.user_id = mr.user_id)
      OR (mr.attendee_id IS NOT NULL AND mse.attendee_id = mr.attendee_id)
    )
  WHERE mr.match_id = p_match_id;

  SELECT jsonb_build_object(
    'userId', CASE
      WHEN mr.user_id IS NOT NULL THEN mr.user_id::text
      ELSE 'guest:' || mr.attendee_id::text
    END,
    'name', COALESCE(p.name, ma.guest_name, 'Joueur'),
    'isGuest', mr.attendee_id IS NOT NULL
  )
  INTO v_mvp
  FROM public.match_results mr
  LEFT JOIN public.profiles p ON p.id = mr.user_id
  LEFT JOIN public.match_attendees ma ON ma.id = mr.attendee_id
  WHERE mr.match_id = p_match_id AND mr.mvp = true
  LIMIT 1;

  RETURN jsonb_build_object(
    'matchId', v_match.id,
    'title', v_match.title,
    'date', v_match.date,
    'locationName', v_match.location_name,
    'format', v_match.format,
    'score', v_score,
    'teamAScore', COALESCE(v_team_a_score, 0),
    'teamBScore', COALESCE(v_team_b_score, 0),
    'completedWithoutStats', COALESCE(v_match.completed_without_stats, false),
    'players', v_players,
    'mvp', v_mvp
  );
END;
$$;

-- ─── open_match_stats : refuser cancelled ─────────────────────
CREATE OR REPLACE FUNCTION public.open_match_stats(
  p_match_id UUID,
  p_team_a_score INT,
  p_team_b_score INT,
  p_roster JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_attendee RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut ouvrir la saisie des stats';
  END IF;

  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Ce match est déjà terminé ou annulé';
  END IF;

  IF v_match.status = 'pending_stats' THEN
    RAISE EXCEPTION 'La saisie des stats est déjà ouverte';
  END IF;

  IF p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Score invalide';
  END IF;

  PERFORM public._seed_match_stat_entries(p_match_id, p_roster);

  IF NOT EXISTS (SELECT 1 FROM public.match_stat_entries WHERE match_id = p_match_id) THEN
    RAISE EXCEPTION 'Aucun joueur présent pour enregistrer les stats';
  END IF;

  UPDATE public.matches
  SET
    status = 'pending_stats',
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    stats_opened_at = now(),
    completed_without_stats = false
  WHERE id = p_match_id;

  DELETE FROM public.match_team_stat_validations WHERE match_id = p_match_id;
  DELETE FROM public.match_mvp_votes WHERE match_id = p_match_id;

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
      'Saisis tes stats',
      '« ' || v_match.title || ' » — Indique tes buts, passes et vote pour le MVP.',
      jsonb_build_object('matchId', p_match_id::text, 'stats', 'true')
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_match_simple(UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_match_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_recap(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_match_stats(UUID, INT, INT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
