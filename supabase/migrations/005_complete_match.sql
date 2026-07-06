-- Migration 005 : terminer un match + stats joueurs
-- Exécuter dans Supabase SQL Editor

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_results_match_user
  ON public.match_results (match_id, user_id)
  WHERE match_id IS NOT NULL;

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
      match_id, user_id, title, played_at, result, score, rating, goals, assists, mvp
    ) VALUES (
      p_match_id, v_user_id, v_match.title, v_match.date,
      v_result, v_score, v_rating, v_goals, v_assists, v_mvp
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

    v_stats := jsonb_set(v_stats, '{matchesPlayed}', to_jsonb(v_old_mp + 1));
    v_stats := jsonb_set(v_stats, '{goals}', to_jsonb(COALESCE((v_stats->>'goals')::INT, 0) + v_goals));
    v_stats := jsonb_set(v_stats, '{assists}', to_jsonb(COALESCE((v_stats->>'assists')::INT, 0) + v_assists));
    v_stats := jsonb_set(v_stats, '{averageRating}', to_jsonb(v_new_avg));

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
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_match(UUID, INT, INT, JSONB) TO authenticated;
