-- Migration 012 : fix doublons save_match_composition
-- Exécuter dans Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.save_match_composition(
  p_match_id UUID,
  p_formation_a TEXT,
  p_formation_b TEXT,
  p_lineups JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_row JSONB;
  v_user_id UUID;
  v_seen UUID[] := '{}';
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut modifier la composition';
  END IF;

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'Match déjà terminé';
  END IF;

  INSERT INTO public.match_compositions (match_id, formation_a, formation_b, validated_at, updated_at)
  VALUES (p_match_id, COALESCE(p_formation_a, 'auto'), COALESCE(p_formation_b, 'auto'), now(), now())
  ON CONFLICT (match_id) DO UPDATE SET
    formation_a = EXCLUDED.formation_a,
    formation_b = EXCLUDED.formation_b,
    validated_at = now(),
    updated_at = now();

  DELETE FROM public.match_lineups WHERE match_id = p_match_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_lineups)
  LOOP
    v_user_id := (v_row->>'user_id')::UUID;
    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;
    IF v_user_id = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := array_append(v_seen, v_user_id);

    INSERT INTO public.match_lineups (match_id, user_id, team_side, slot_id, pos_x, pos_y)
    VALUES (
      p_match_id,
      v_user_id,
      v_row->>'team_side',
      NULLIF(v_row->>'slot_id', ''),
      NULLIF(v_row->>'pos_x', '')::DOUBLE PRECISION,
      NULLIF(v_row->>'pos_y', '')::DOUBLE PRECISION
    )
    ON CONFLICT (match_id, user_id) DO UPDATE SET
      team_side = EXCLUDED.team_side,
      slot_id = EXCLUDED.slot_id,
      pos_x = EXCLUDED.pos_x,
      pos_y = EXCLUDED.pos_y;
  END LOOP;
END;
$$;
