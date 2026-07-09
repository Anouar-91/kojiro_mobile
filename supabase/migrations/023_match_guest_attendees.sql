-- Migration 023 : joueurs invités sans compte (ajout manuel par l'organisateur)
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.match_attendees
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.match_attendees
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

ALTER TABLE public.match_attendees DROP CONSTRAINT IF EXISTS match_attendees_match_id_user_id_key;

ALTER TABLE public.match_attendees DROP CONSTRAINT IF EXISTS match_attendees_identity_check;
ALTER TABLE public.match_attendees
  ADD CONSTRAINT match_attendees_identity_check
  CHECK (
    (user_id IS NOT NULL AND guest_name IS NULL)
    OR (user_id IS NULL AND guest_name IS NOT NULL AND length(trim(guest_name)) > 0)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendees_match_user
  ON public.match_attendees (match_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendees_match_guest_name
  ON public.match_attendees (match_id, lower(trim(guest_name)))
  WHERE user_id IS NULL;

-- ─── Lineups : supporter les guests ─────────────────────────
-- D'abord supprimer la PK (user_id ne peut pas devenir nullable tant qu'il en fait partie)
ALTER TABLE public.match_lineups DROP CONSTRAINT IF EXISTS match_lineups_pkey;

ALTER TABLE public.match_lineups
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.match_lineups
  ADD COLUMN IF NOT EXISTS attendee_id UUID REFERENCES public.match_attendees(id) ON DELETE CASCADE;

ALTER TABLE public.match_lineups DROP CONSTRAINT IF EXISTS match_lineups_participant_check;
ALTER TABLE public.match_lineups
  ADD CONSTRAINT match_lineups_participant_check
  CHECK (
    (user_id IS NOT NULL AND attendee_id IS NULL)
    OR (user_id IS NULL AND attendee_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_lineups_user
  ON public.match_lineups (match_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_lineups_attendee
  ON public.match_lineups (match_id, attendee_id)
  WHERE attendee_id IS NOT NULL;

-- ─── Quota : exclure la ligne courante par id ───────────────
CREATE OR REPLACE FUNCTION public.enforce_match_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max INT;
  v_present INT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'present' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'present' THEN
    RETURN NEW;
  END IF;

  SELECT max_players INTO v_max
  FROM public.matches
  WHERE id = NEW.match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  SELECT COUNT(*)::INT INTO v_present
  FROM public.match_attendees
  WHERE match_id = NEW.match_id
    AND status = 'present'
    AND id IS DISTINCT FROM NEW.id;

  IF v_present >= v_max THEN
    RAISE EXCEPTION 'Ce match est complet (% places)', v_max;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Ajouter un guest ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.organizer_add_guest(
  p_match_id UUID,
  p_guest_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_name TEXT;
  v_attendee_id UUID;
  v_present INT;
BEGIN
  v_name := trim(p_guest_name);
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Nom trop court (2 caractères minimum)';
  END IF;
  IF length(v_name) > 60 THEN
    RAISE EXCEPTION 'Nom trop long (60 caractères maximum)';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut ajouter un joueur';
  END IF;

  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Ce match n''est plus modifiable';
  END IF;

  SELECT COUNT(*)::INT INTO v_present
  FROM public.match_attendees
  WHERE match_id = p_match_id AND status = 'present';

  IF v_present >= v_match.max_players THEN
    RAISE EXCEPTION 'Ce match est complet (% places)', v_match.max_players;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_attendees
    WHERE match_id = p_match_id
      AND user_id IS NULL
      AND lower(trim(guest_name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Ce joueur est déjà dans l''effectif';
  END IF;

  INSERT INTO public.match_attendees (match_id, guest_name, status)
  VALUES (p_match_id, v_name, 'present')
  RETURNING id INTO v_attendee_id;

  RETURN v_attendee_id;
END;
$$;

-- ─── Retirer un participant (compte ou guest) ────────────────
CREATE OR REPLACE FUNCTION public.organizer_remove_attendee_by_id(
  p_attendee_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attendee RECORD;
  v_match RECORD;
  v_player_name TEXT;
BEGIN
  SELECT * INTO v_attendee FROM public.match_attendees WHERE id = p_attendee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant introuvable';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_attendee.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut retirer un joueur';
  END IF;

  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Ce match n''est plus modifiable';
  END IF;

  IF v_attendee.user_id = v_match.organizer_id THEN
    RAISE EXCEPTION 'Tu ne peux pas te retirer toi-même du match';
  END IF;

  IF v_attendee.user_id IS NOT NULL THEN
    SELECT name INTO v_player_name FROM public.profiles WHERE id = v_attendee.user_id;

    DELETE FROM public.match_lineups
    WHERE match_id = v_attendee.match_id AND user_id = v_attendee.user_id;

    DELETE FROM public.match_attendees WHERE id = p_attendee_id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_attendee.user_id,
      'match_reminder',
      'Retiré du match',
      'L''organisateur t''a retiré de « ' || v_match.title || ' ».',
      jsonb_build_object('matchId', v_attendee.match_id::text)
    );
  ELSE
    DELETE FROM public.match_lineups
    WHERE match_id = v_attendee.match_id AND attendee_id = p_attendee_id;

    DELETE FROM public.match_attendees WHERE id = p_attendee_id;
  END IF;
END;
$$;

-- Garder l'ancienne RPC pour compatibilité (délègue à by_id)
CREATE OR REPLACE FUNCTION public.organizer_remove_attendee(
  p_match_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attendee_id UUID;
BEGIN
  SELECT id INTO v_attendee_id
  FROM public.match_attendees
  WHERE match_id = p_match_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce joueur ne fait pas partie du match';
  END IF;

  PERFORM public.organizer_remove_attendee_by_id(v_attendee_id);
END;
$$;

-- ─── Composition : guests dans les lineups ──────────────────
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
  v_attendee_id UUID;
  v_seen_users UUID[] := '{}';
  v_seen_attendees UUID[] := '{}';
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
        v_row->>'team_side',
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
        v_row->>'team_side',
        NULLIF(v_row->>'slot_id', ''),
        NULLIF(v_row->>'pos_x', '')::DOUBLE PRECISION,
        NULLIF(v_row->>'pos_y', '')::DOUBLE PRECISION
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.organizer_add_guest(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_remove_attendee_by_id(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
