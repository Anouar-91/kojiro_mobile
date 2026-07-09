-- Migration 025 : poste optionnel pour les joueurs invités
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.match_attendees
  ADD COLUMN IF NOT EXISTS guest_position TEXT;

ALTER TABLE public.match_attendees DROP CONSTRAINT IF EXISTS match_attendees_guest_position_check;
ALTER TABLE public.match_attendees
  ADD CONSTRAINT match_attendees_guest_position_check
  CHECK (guest_position IS NULL OR guest_position IN ('GK', 'DEF', 'MID', 'FWD'));

CREATE OR REPLACE FUNCTION public.organizer_add_guest(
  p_match_id UUID,
  p_guest_name TEXT,
  p_guest_position TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_name TEXT;
  v_position TEXT;
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

  v_position := NULLIF(upper(trim(COALESCE(p_guest_position, ''))), '');
  IF v_position IS NOT NULL AND v_position NOT IN ('GK', 'DEF', 'MID', 'FWD') THEN
    RAISE EXCEPTION 'Poste invalide (GK, DEF, MID ou FWD)';
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

  IF COALESCE(v_match.recruitment_closed, false) THEN
    RAISE EXCEPTION 'Le recrutement est fermé pour ce match';
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

  INSERT INTO public.match_attendees (match_id, guest_name, guest_position, status)
  VALUES (p_match_id, v_name, v_position, 'present')
  RETURNING id INTO v_attendee_id;

  RETURN v_attendee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.organizer_add_guest(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
