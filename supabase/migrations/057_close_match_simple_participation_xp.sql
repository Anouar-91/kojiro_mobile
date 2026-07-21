-- Migration 057 : XP de participation (+25) sur clôture sans stats
-- À exécuter si 056 a déjà été appliquée sans cet XP.
-- Sinon, 056 à jour suffit (contient déjà ce comportement).

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

GRANT EXECUTE ON FUNCTION public.close_match_simple(UUID, INT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
