-- Les invitations directes ne peuvent cibler que des amis,
-- même sur un match ouvert à tous (les autres peuvent toujours rejoindre seuls).

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

  IF NOT public.users_are_friends(auth.uid(), p_user_id) THEN
    RAISE EXCEPTION 'Tu ne peux inviter que tes amis';
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
