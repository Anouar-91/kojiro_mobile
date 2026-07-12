-- Migration 049 : suggestions d'invitation par les participants (validation organisateur)

CREATE TABLE IF NOT EXISTS public.match_invite_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  suggested_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suggested_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_suggestions_pending_user
  ON public.match_invite_suggestions (match_id, suggested_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_match_suggestions_match_pending
  ON public.match_invite_suggestions (match_id)
  WHERE status = 'pending';

ALTER TABLE public.match_invite_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suggestions_select_involved" ON public.match_invite_suggestions;
CREATE POLICY "suggestions_select_involved" ON public.match_invite_suggestions
  FOR SELECT USING (
    suggested_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.organizer_id = auth.uid()
    )
  );

-- ─── Helpers ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.users_are_friends(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND (
        (fr.from_user_id = p_user_a AND fr.to_user_id = p_user_b)
        OR (fr.from_user_id = p_user_b AND fr.to_user_id = p_user_a)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_match_participant(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_attendees ma
    WHERE ma.match_id = p_match_id
      AND ma.user_id = p_user_id
      AND ma.status IN ('present', 'maybe', 'waitlist', 'pending')
  );
$$;

CREATE OR REPLACE FUNCTION public._send_match_invite(
  p_match_id UUID,
  p_user_id UUID,
  p_inviter_id UUID
)
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

  IF v_match.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Ce match n''accepte plus d''invitations';
  END IF;

  IF v_match.recruitment_closed THEN
    RAISE EXCEPTION 'Le recrutement est fermé';
  END IF;

  IF p_user_id = p_inviter_id THEN
    RAISE EXCEPTION 'Tu ne peux pas t''inviter toi-même';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Joueur introuvable';
  END IF;

  SELECT name INTO v_inviter_name FROM public.profiles WHERE id = p_inviter_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_attendees
    WHERE match_id = p_match_id AND user_id = p_user_id
  ) THEN
    INSERT INTO public.match_attendees (match_id, user_id, status)
    VALUES (p_match_id, p_user_id, 'pending');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_user_id,
    'match_invite',
    'Invitation au match',
    v_inviter_name || ' t''invite à « ' || v_match.title || ' »',
    jsonb_build_object(
      'matchId', p_match_id::text,
      'inviterId', p_inviter_id::text
    )
  );
END;
$$;

-- ─── Inviter (organisateur) — refactor ──────────────────────

CREATE OR REPLACE FUNCTION public.invite_to_match(p_match_id UUID, p_user_id UUID)
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
    RAISE EXCEPTION 'Seul l''organisateur peut inviter';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_attendees
    WHERE match_id = p_match_id
      AND user_id = p_user_id
      AND status != 'absent'
  ) THEN
    RAISE EXCEPTION 'Ce joueur fait déjà partie du match';
  END IF;

  PERFORM public._send_match_invite(p_match_id, p_user_id, auth.uid());
END;
$$;

-- ─── Suggérer un ami (participant) ────────────────────────────

CREATE OR REPLACE FUNCTION public.suggest_player_to_match(
  p_match_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_suggester_name TEXT;
  v_suggested_name TEXT;
  v_suggestion_id UUID;
BEGIN
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Tu ne peux pas te proposer toi-même';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Ce match n''accepte plus de suggestions';
  END IF;

  IF v_match.recruitment_closed THEN
    RAISE EXCEPTION 'Le recrutement est fermé';
  END IF;

  IF v_match.organizer_id = auth.uid() THEN
    RAISE EXCEPTION 'Utilise l''invitation directe en tant qu''organisateur';
  END IF;

  IF NOT public.is_active_match_participant(p_match_id, auth.uid()) THEN
    RAISE EXCEPTION 'Tu dois participer au match pour proposer un ami';
  END IF;

  IF NOT public.users_are_friends(auth.uid(), p_user_id) THEN
    RAISE EXCEPTION 'Tu ne peux proposer que tes amis';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Joueur introuvable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_attendees
    WHERE match_id = p_match_id
      AND user_id = p_user_id
      AND status != 'absent'
  ) THEN
    RAISE EXCEPTION 'Ce joueur fait déjà partie du match';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_invite_suggestions
    WHERE match_id = p_match_id
      AND suggested_user_id = p_user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Une suggestion est déjà en attente pour ce joueur';
  END IF;

  IF (
    SELECT COUNT(*)::INT FROM public.match_invite_suggestions
    WHERE match_id = p_match_id
      AND suggested_by_user_id = auth.uid()
      AND status = 'pending'
  ) >= 5 THEN
    RAISE EXCEPTION 'Tu as déjà 5 suggestions en attente pour ce match';
  END IF;

  INSERT INTO public.match_invite_suggestions (
    match_id, suggested_user_id, suggested_by_user_id
  )
  VALUES (p_match_id, p_user_id, auth.uid())
  RETURNING id INTO v_suggestion_id;

  SELECT name INTO v_suggester_name FROM public.profiles WHERE id = auth.uid();
  SELECT name INTO v_suggested_name FROM public.profiles WHERE id = p_user_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_match.organizer_id,
    'match_invite_suggestion',
    'Suggestion d''invitation',
    COALESCE(v_suggester_name, 'Un joueur') || ' propose d''inviter ' || COALESCE(v_suggested_name, 'un ami') || ' à « ' || v_match.title || ' »',
    jsonb_build_object(
      'matchId', p_match_id::text,
      'suggestionId', v_suggestion_id::text,
      'suggestedUserId', p_user_id::text,
      'suggestedByUserId', auth.uid()::text
    )
  );

  RETURN v_suggestion_id;
END;
$$;

-- ─── Approuver une suggestion (organisateur) ────────────────

CREATE OR REPLACE FUNCTION public.approve_match_suggestion(p_suggestion_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_suggestion RECORD;
  v_match RECORD;
BEGIN
  SELECT * INTO v_suggestion
  FROM public.match_invite_suggestions
  WHERE id = p_suggestion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion introuvable';
  END IF;

  IF v_suggestion.status != 'pending' THEN
    RAISE EXCEPTION 'Cette suggestion a déjà été traitée';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_suggestion.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut approuver';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_attendees
    WHERE match_id = v_suggestion.match_id
      AND user_id = v_suggestion.suggested_user_id
      AND status != 'absent'
  ) THEN
    UPDATE public.match_invite_suggestions
    SET status = 'rejected', resolved_at = now()
    WHERE id = p_suggestion_id;
    RAISE EXCEPTION 'Ce joueur fait déjà partie du match';
  END IF;

  PERFORM public._send_match_invite(
    v_suggestion.match_id,
    v_suggestion.suggested_user_id,
    auth.uid()
  );

  UPDATE public.match_invite_suggestions
  SET status = 'approved', resolved_at = now()
  WHERE id = p_suggestion_id;
END;
$$;

-- ─── Refuser une suggestion (organisateur) ────────────────────

CREATE OR REPLACE FUNCTION public.reject_match_suggestion(p_suggestion_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_suggestion RECORD;
  v_match RECORD;
  v_suggested_name TEXT;
BEGIN
  SELECT * INTO v_suggestion
  FROM public.match_invite_suggestions
  WHERE id = p_suggestion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion introuvable';
  END IF;

  IF v_suggestion.status != 'pending' THEN
    RAISE EXCEPTION 'Cette suggestion a déjà été traitée';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_suggestion.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut refuser';
  END IF;

  UPDATE public.match_invite_suggestions
  SET status = 'rejected', resolved_at = now()
  WHERE id = p_suggestion_id;

  SELECT name INTO v_suggested_name
  FROM public.profiles
  WHERE id = v_suggestion.suggested_user_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_suggestion.suggested_by_user_id,
    'match_reminder',
    'Suggestion refusée',
    'L''organisateur a refusé ta suggestion d''inviter ' || COALESCE(v_suggested_name, 'ce joueur') || ' à « ' || v_match.title || ' »',
    jsonb_build_object('matchId', v_suggestion.match_id::text)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_player_to_match(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_match_suggestion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_match_suggestion(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
