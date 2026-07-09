-- Migration 024 : fermeture du recrutement (verrou asymétrique)
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS recruitment_closed BOOLEAN NOT NULL DEFAULT false;

-- ─── Présences : verrou complet ou asymétrique ───────────────
CREATE OR REPLACE FUNCTION public.enforce_attendance_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_recruitment_closed BOOLEAN;
BEGIN
  SELECT status, recruitment_closed
  INTO v_status, v_recruitment_closed
  FROM public.matches
  WHERE id = NEW.match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Les présences ne peuvent plus être modifiées pour ce match';
  END IF;

  -- Match live : seul le retrait (absent) est autorisé
  IF v_status = 'live' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Les inscriptions sont fermées pour ce match';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'absent' THEN
      RAISE EXCEPTION 'Tu peux uniquement te désister pendant le match';
    END IF;
    RETURN NEW;
  END IF;

  -- Recrutement fermé : retrait libre, waitlist → present si place, sinon bloqué
  IF v_recruitment_closed THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Le recrutement est fermé pour ce match';
    END IF;

    IF NEW.status = 'absent' THEN
      RETURN NEW;
    END IF;

    IF OLD.status = 'waitlist' AND NEW.status = 'present' THEN
      RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Le recrutement est fermé — tu peux uniquement te désister';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Fermer / rouvrir le recrutement ─────────────────────────
CREATE OR REPLACE FUNCTION public.close_match_recruitment(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut fermer le recrutement';
  END IF;

  IF v_match.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Le recrutement ne peut être fermé que pour un match à venir';
  END IF;

  IF v_match.recruitment_closed THEN
    RETURN;
  END IF;

  UPDATE public.matches
  SET recruitment_closed = true
  WHERE id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_match_recruitment(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut rouvrir le recrutement';
  END IF;

  IF v_match.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Le recrutement ne peut être rouvert que pour un match à venir';
  END IF;

  IF NOT v_match.recruitment_closed THEN
    RETURN;
  END IF;

  UPDATE public.matches
  SET recruitment_closed = false
  WHERE id = p_match_id;
END;
$$;

-- ─── Invitations : bloquer si recrutement fermé ────────────────
CREATE OR REPLACE FUNCTION public.invite_to_match(p_match_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_inviter_name TEXT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut inviter';
  END IF;

  IF v_match.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Ce match n''accepte plus d''invitations';
  END IF;

  IF v_match.recruitment_closed THEN
    RAISE EXCEPTION 'Le recrutement est fermé pour ce match';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Tu ne peux pas t''inviter toi-même';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Joueur introuvable';
  END IF;

  SELECT name INTO v_inviter_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.match_attendees (match_id, user_id, status)
  VALUES (p_match_id, p_user_id, 'pending')
  ON CONFLICT (match_id, user_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_user_id,
    'match_invite',
    'Invitation au match',
    v_inviter_name || ' t''invite à « ' || v_match.title || ' ».',
    jsonb_build_object('matchId', p_match_id::text)
  );
END;
$$;

-- ─── Guests : bloquer si recrutement fermé ───────────────────
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

  IF v_match.recruitment_closed THEN
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

  INSERT INTO public.match_attendees (match_id, guest_name, status)
  VALUES (p_match_id, v_name, 'present')
  RETURNING id INTO v_attendee_id;

  RETURN v_attendee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_match_recruitment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_match_recruitment(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
