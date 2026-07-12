-- Migration 046 : réouverture des stats en conservant les données + notification joueurs

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
        self_def_rating = COALESCE(v_row.def_rating, 3.0),
        self_fair_play = COALESCE(v_row.fair_play, 4.0),
        captain_goals = v_row.goals,
        captain_assists = v_row.assists,
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

    v_xp_gain := 50
      + v_row.goals * 10
      + v_row.assists * 5
      + CASE WHEN v_row.mvp THEN 25 ELSE 0 END
      + GREATEST(0, ROUND((COALESCE(v_row.def_rating, 3.0) - 3.0) * 5)::INT);
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

GRANT EXECUTE ON FUNCTION public.reopen_match_stats(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
