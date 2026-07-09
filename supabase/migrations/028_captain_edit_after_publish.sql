-- Migration 028 : capitaines peuvent éditer après publication
-- Verrou uniquement quand le match est live ou terminé
-- Exécuter dans Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.save_match_composition(
  p_match_id UUID,
  p_formation_a TEXT,
  p_formation_b TEXT,
  p_lineups JSONB,
  p_publish BOOLEAN DEFAULT false,
  p_edit_side TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_comp RECORD;
  v_row JSONB;
  v_user_id UUID;
  v_attendee_id UUID;
  v_seen_users UUID[] := '{}';
  v_seen_attendees UUID[] := '{}';
  v_is_organizer BOOLEAN;
  v_is_captain_a BOOLEAN;
  v_is_captain_b BOOLEAN;
  v_side TEXT;
  v_comp_found BOOLEAN;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'Match déjà terminé';
  END IF;

  IF v_match.status = 'live' THEN
    RAISE EXCEPTION 'Le match est en cours — la composition ne peut plus être modifiée';
  END IF;

  SELECT * INTO v_comp FROM public.match_compositions WHERE match_id = p_match_id;
  v_comp_found := FOUND;

  v_is_organizer := v_match.organizer_id = auth.uid();
  IF v_comp_found THEN
    v_is_captain_a := v_comp.captain_a_id IS NOT NULL AND v_comp.captain_a_id = auth.uid();
    v_is_captain_b := v_comp.captain_b_id IS NOT NULL AND v_comp.captain_b_id = auth.uid();
  ELSE
    v_is_captain_a := false;
    v_is_captain_b := false;
  END IF;

  IF p_publish AND NOT v_is_organizer THEN
    RAISE EXCEPTION 'Seul l''organisateur peut publier la composition';
  END IF;

  IF NOT v_is_organizer THEN
    IF p_publish THEN
      RAISE EXCEPTION 'Seul l''organisateur peut publier la composition';
    END IF;

    IF p_edit_side = 'A' AND v_is_captain_a THEN
      NULL;
    ELSIF p_edit_side = 'B' AND v_is_captain_b THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Permission refusée pour modifier la composition';
    END IF;
  END IF;

  IF p_edit_side IS NOT NULL AND p_edit_side NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'Côté d''édition invalide';
  END IF;

  INSERT INTO public.match_compositions (match_id, formation_a, formation_b, validated_at, updated_at)
  VALUES (
    p_match_id,
    COALESCE(p_formation_a, 'auto'),
    COALESCE(p_formation_b, 'auto'),
    CASE WHEN p_publish THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (match_id) DO UPDATE SET
    formation_a = CASE
      WHEN p_edit_side IS NULL OR p_edit_side = 'A' THEN COALESCE(p_formation_a, match_compositions.formation_a)
      ELSE match_compositions.formation_a
    END,
    formation_b = CASE
      WHEN p_edit_side IS NULL OR p_edit_side = 'B' THEN COALESCE(p_formation_b, match_compositions.formation_b)
      ELSE match_compositions.formation_b
    END,
    validated_at = CASE
      WHEN p_publish THEN now()
      ELSE match_compositions.validated_at
    END,
    updated_at = now();

  IF p_edit_side IS NULL THEN
    DELETE FROM public.match_lineups WHERE match_id = p_match_id;
  ELSE
    DELETE FROM public.match_lineups
    WHERE match_id = p_match_id AND team_side = p_edit_side;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_lineups)
  LOOP
    v_side := v_row->>'team_side';

    IF p_edit_side IS NOT NULL AND v_side IS DISTINCT FROM p_edit_side THEN
      CONTINUE;
    END IF;

    v_user_id := NULLIF(v_row->>'user_id', '')::UUID;
    v_attendee_id := NULLIF(v_row->>'attendee_id', '')::UUID;

    IF v_user_id IS NOT NULL THEN
      IF v_user_id = ANY(v_seen_users) THEN
        CONTINUE;
      END IF;
      v_seen_users := array_append(v_seen_users, v_user_id);

      INSERT INTO public.match_lineups (match_id, user_id, team_side, slot_id, pos_x, pos_y)
      VALUES (
        p_match_id,
        v_user_id,
        v_side,
        NULLIF(v_row->>'slot_id', ''),
        NULLIF(v_row->>'pos_x', '')::DOUBLE PRECISION,
        NULLIF(v_row->>'pos_y', '')::DOUBLE PRECISION
      );
    ELSIF v_attendee_id IS NOT NULL THEN
      IF v_attendee_id = ANY(v_seen_attendees) THEN
        CONTINUE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.match_attendees
        WHERE id = v_attendee_id
          AND match_id = p_match_id
          AND user_id IS NULL
          AND status = 'present'
      ) THEN
        CONTINUE;
      END IF;
      v_seen_attendees := array_append(v_seen_attendees, v_attendee_id);

      INSERT INTO public.match_lineups (match_id, attendee_id, team_side, slot_id, pos_x, pos_y)
      VALUES (
        p_match_id,
        v_attendee_id,
        v_side,
        NULLIF(v_row->>'slot_id', ''),
        NULLIF(v_row->>'pos_x', '')::DOUBLE PRECISION,
        NULLIF(v_row->>'pos_y', '')::DOUBLE PRECISION
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_match_composition(UUID, TEXT, TEXT, JSONB, BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
