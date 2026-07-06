-- Migration 006 : invitations match
-- Exécuter dans Supabase SQL Editor

-- L'organisateur peut envoyer des notifs match aux joueurs
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR (
      type IN ('match_invite', 'match_reminder')
      AND data ? 'matchId'
      AND EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = (data->>'matchId')::uuid
          AND m.organizer_id = auth.uid()
      )
    )
  );

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

  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Ce match n''accepte plus d''invitations';
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
    v_inviter_name || ' t''invite à « ' || v_match.title || ' »',
    jsonb_build_object(
      'matchId', p_match_id::text,
      'inviterId', auth.uid()::text
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_to_match(UUID, UUID) TO authenticated;
