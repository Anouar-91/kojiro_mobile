-- Migration 055 : proposition d'ami via le chat (friend_invite)

ALTER TABLE public.match_proposals
  DROP CONSTRAINT IF EXISTS match_proposals_proposal_type_check;

ALTER TABLE public.match_proposals
  ADD CONSTRAINT match_proposals_proposal_type_check
  CHECK (proposal_type IN ('guest_add', 'player_transfer', 'team_split', 'friend_invite'));

CREATE OR REPLACE FUNCTION public.create_match_proposal(
  p_match_id UUID,
  p_proposal_type TEXT,
  p_payload JSONB,
  p_content TEXT
)
RETURNS TABLE (message_id UUID, proposal_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_proposal_id UUID;
  v_message_id UUID;
  v_content TEXT;
  v_guest_name TEXT;
  v_position TEXT;
  v_player_name TEXT;
  v_from_side TEXT;
  v_to_side TEXT;
  v_friend_id UUID;
  v_friend_name TEXT;
  v_proposer_name TEXT;
  v_auto_accept BOOLEAN := false;
  v_status TEXT := 'pending';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT public.can_access_match_chat(p_match_id, auth.uid()) THEN
    RAISE EXCEPTION 'Tu n''as pas accès au chat de ce match';
  END IF;

  IF p_proposal_type NOT IN ('guest_add', 'player_transfer', 'team_split', 'friend_invite') THEN
    RAISE EXCEPTION 'Type de proposition invalide';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.status IN ('completed', 'cancelled', 'live', 'pending_stats') THEN
    RAISE EXCEPTION 'Ce match n''accepte plus de propositions';
  END IF;

  v_content := NULLIF(trim(COALESCE(p_content, '')), '');
  IF v_content IS NULL THEN
    RAISE EXCEPTION 'Résumé de proposition manquant';
  END IF;
  IF length(v_content) > 280 THEN
    v_content := left(v_content, 277) || '…';
  END IF;

  IF p_proposal_type = 'guest_add' THEN
    v_guest_name := trim(COALESCE(p_payload->>'guest_name', ''));
    IF length(v_guest_name) < 2 THEN
      RAISE EXCEPTION 'Nom trop court (2 caractères minimum)';
    END IF;
    IF length(v_guest_name) > 60 THEN
      RAISE EXCEPTION 'Nom trop long (60 caractères maximum)';
    END IF;
    v_position := NULLIF(upper(trim(COALESCE(p_payload->>'guest_position', ''))), '');
    IF v_position IS NOT NULL AND v_position NOT IN ('GK', 'DEF', 'MID', 'FWD') THEN
      RAISE EXCEPTION 'Poste invalide (GK, DEF, MID ou FWD)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.match_attendees
      WHERE match_id = p_match_id
        AND user_id IS NULL
        AND lower(trim(guest_name)) = lower(v_guest_name)
    ) THEN
      RAISE EXCEPTION 'Ce joueur est déjà dans l''effectif';
    END IF;
    p_payload := jsonb_build_object(
      'guest_name', v_guest_name,
      'guest_position', to_jsonb(v_position)
    );

  ELSIF p_proposal_type = 'player_transfer' THEN
    IF NULLIF(trim(COALESCE(p_payload->>'player_id', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Joueur manquant';
    END IF;
    v_from_side := upper(trim(COALESCE(p_payload->>'from_side', '')));
    v_to_side := upper(trim(COALESCE(p_payload->>'to_side', '')));
    IF v_from_side NOT IN ('A', 'B') OR v_to_side NOT IN ('A', 'B') OR v_from_side = v_to_side THEN
      RAISE EXCEPTION 'Transfert invalide';
    END IF;
    v_player_name := NULLIF(trim(COALESCE(p_payload->>'player_name', '')), '');
    p_payload := jsonb_build_object(
      'player_id', trim(p_payload->>'player_id'),
      'player_name', COALESCE(v_player_name, 'Un joueur'),
      'from_side', v_from_side,
      'to_side', v_to_side
    );

  ELSIF p_proposal_type = 'team_split' THEN
    IF p_payload->'lineups' IS NULL OR jsonb_typeof(p_payload->'lineups') <> 'array' THEN
      RAISE EXCEPTION 'Composition manquante';
    END IF;
    IF jsonb_array_length(p_payload->'lineups') < 2 THEN
      RAISE EXCEPTION 'Composition trop courte';
    END IF;

  ELSIF p_proposal_type = 'friend_invite' THEN
    IF COALESCE(v_match.recruitment_closed, false) THEN
      RAISE EXCEPTION 'Le recrutement est fermé';
    END IF;
    IF v_match.status <> 'upcoming' THEN
      RAISE EXCEPTION 'Ce match n''accepte plus d''invitations';
    END IF;

    BEGIN
      v_friend_id := (NULLIF(trim(COALESCE(p_payload->>'user_id', '')), ''))::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Ami invalide';
    END;

    IF v_friend_id IS NULL THEN
      RAISE EXCEPTION 'Ami manquant';
    END IF;
    IF v_friend_id = auth.uid() THEN
      RAISE EXCEPTION 'Tu ne peux pas te proposer toi-même';
    END IF;
    IF NOT public.users_are_friends(auth.uid(), v_friend_id) THEN
      RAISE EXCEPTION 'Tu ne peux proposer que tes amis';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_friend_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Joueur introuvable';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.match_attendees
      WHERE match_id = p_match_id
        AND user_id = v_friend_id
        AND status != 'absent'
    ) THEN
      RAISE EXCEPTION 'Ce joueur fait déjà partie du match';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.match_proposals
      WHERE match_id = p_match_id
        AND proposal_type = 'friend_invite'
        AND status = 'pending'
        AND payload->>'user_id' = v_friend_id::text
    ) THEN
      RAISE EXCEPTION 'Une proposition est déjà en attente pour cet ami';
    END IF;

    SELECT name INTO v_friend_name FROM public.profiles WHERE id = v_friend_id;
    p_payload := jsonb_build_object(
      'user_id', v_friend_id::text,
      'user_name', COALESCE(NULLIF(trim(COALESCE(p_payload->>'user_name', '')), ''), v_friend_name, 'Un ami')
    );
  END IF;

  IF v_match.organizer_id = auth.uid() THEN
    v_auto_accept := true;
    v_status := 'accepted';
  END IF;

  INSERT INTO public.match_proposals (
    match_id, proposed_by, proposal_type, payload, status, resolved_by, resolved_at
  ) VALUES (
    p_match_id,
    auth.uid(),
    p_proposal_type,
    p_payload,
    v_status,
    CASE WHEN v_auto_accept THEN auth.uid() ELSE NULL END,
    CASE WHEN v_auto_accept THEN now() ELSE NULL END
  )
  RETURNING id INTO v_proposal_id;

  IF v_auto_accept THEN
    IF p_proposal_type = 'guest_add' THEN
      PERFORM public.organizer_add_guest(
        p_match_id,
        p_payload->>'guest_name',
        NULLIF(p_payload->>'guest_position', '')
      );
    ELSIF p_proposal_type = 'player_transfer' THEN
      PERFORM public._apply_player_transfer(p_match_id, p_payload);
    ELSIF p_proposal_type = 'team_split' THEN
      PERFORM public.save_match_composition(
        p_match_id,
        COALESCE(p_payload->>'formation_a', 'auto'),
        COALESCE(p_payload->>'formation_b', 'auto'),
        p_payload->'lineups',
        false,
        NULL
      );
    ELSIF p_proposal_type = 'friend_invite' THEN
      PERFORM public._send_match_invite(
        p_match_id,
        (p_payload->>'user_id')::UUID,
        auth.uid()
      );
    END IF;
  END IF;

  INSERT INTO public.messages (match_id, sender_id, content, type, proposal_id)
  VALUES (p_match_id, auth.uid(), v_content, 'action', v_proposal_id)
  RETURNING id INTO v_message_id;

  IF NOT v_auto_accept AND v_match.organizer_id IS DISTINCT FROM auth.uid() THEN
    SELECT name INTO v_proposer_name FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_match.organizer_id,
      'match_proposal',
      'Proposition à valider',
      COALESCE(v_proposer_name, 'Quelqu''un') || ' · ' || v_content,
      jsonb_build_object(
        'matchId', p_match_id::text,
        'proposalId', v_proposal_id::text,
        'chat', 'true'
      )
    );
  END IF;

  message_id := v_message_id;
  proposal_id := v_proposal_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_match_proposal(
  p_proposal_id UUID,
  p_accept BOOLEAN
)
RETURNS public.match_proposals
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_proposal public.match_proposals;
  v_match RECORD;
  v_result public.match_proposals;
  v_friend_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_proposal FROM public.match_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposition introuvable';
  END IF;

  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette proposition a déjà été traitée';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_proposal.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut valider cette proposition';
  END IF;

  IF v_match.status IN ('completed', 'cancelled', 'live', 'pending_stats') THEN
    RAISE EXCEPTION 'Ce match n''est plus modifiable';
  END IF;

  IF p_accept THEN
    IF v_proposal.proposal_type = 'guest_add' THEN
      PERFORM public.organizer_add_guest(
        v_proposal.match_id,
        v_proposal.payload->>'guest_name',
        NULLIF(v_proposal.payload->>'guest_position', '')
      );
    ELSIF v_proposal.proposal_type = 'player_transfer' THEN
      PERFORM public._apply_player_transfer(v_proposal.match_id, v_proposal.payload);
    ELSIF v_proposal.proposal_type = 'team_split' THEN
      PERFORM public.save_match_composition(
        v_proposal.match_id,
        COALESCE(v_proposal.payload->>'formation_a', 'auto'),
        COALESCE(v_proposal.payload->>'formation_b', 'auto'),
        v_proposal.payload->'lineups',
        false,
        NULL
      );
    ELSIF v_proposal.proposal_type = 'friend_invite' THEN
      IF COALESCE(v_match.recruitment_closed, false) THEN
        RAISE EXCEPTION 'Le recrutement est fermé';
      END IF;
      v_friend_id := (v_proposal.payload->>'user_id')::UUID;
      IF EXISTS (
        SELECT 1 FROM public.match_attendees
        WHERE match_id = v_proposal.match_id
          AND user_id = v_friend_id
          AND status != 'absent'
      ) THEN
        RAISE EXCEPTION 'Ce joueur fait déjà partie du match';
      END IF;
      PERFORM public._send_match_invite(
        v_proposal.match_id,
        v_friend_id,
        auth.uid()
      );
    END IF;
  END IF;

  UPDATE public.match_proposals
  SET
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    resolved_by = auth.uid(),
    resolved_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO v_result;

  IF v_proposal.proposed_by IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_proposal.proposed_by,
      'match_proposal',
      CASE WHEN p_accept THEN 'Proposition acceptée' ELSE 'Proposition refusée' END,
      CASE
        WHEN p_accept THEN 'L''organisateur a accepté ta proposition'
        ELSE 'L''organisateur a refusé ta proposition'
      END,
      jsonb_build_object(
        'matchId', v_proposal.match_id::text,
        'proposalId', p_proposal_id::text,
        'chat', 'true',
        'accepted', p_accept
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
