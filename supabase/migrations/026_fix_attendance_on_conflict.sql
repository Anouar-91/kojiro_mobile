-- Migration 026 : corriger ON CONFLICT après index partiel (migration 023)
-- La contrainte UNIQUE (match_id, user_id) a été remplacée par un index partiel
-- WHERE user_id IS NOT NULL — ON CONFLICT (match_id, user_id) ne fonctionne plus.
-- Exécuter dans Supabase SQL Editor

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
    v_inviter_name || ' t''invite à « ' || v_match.title || ' ».',
    jsonb_build_object('matchId', p_match_id::text)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
