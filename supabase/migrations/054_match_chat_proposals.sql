-- Migration 054 : propositions d'organisation via le chat (guest, transfert, équipes)
-- Acceptation : organisateur uniquement

-- ─── messages.type : ajouter 'action' ───────────────────────

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'image', 'system', 'action'));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS proposal_id UUID;

-- ─── Table propositions ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.match_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES public.profiles(id),
  proposal_type TEXT NOT NULL
    CHECK (proposal_type IN ('guest_add', 'player_transfer', 'team_split')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_proposals_match
  ON public.match_proposals (match_id);

CREATE INDEX IF NOT EXISTS idx_match_proposals_match_pending
  ON public.match_proposals (match_id)
  WHERE status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_proposal_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_proposal_id_fkey
      FOREIGN KEY (proposal_id) REFERENCES public.match_proposals(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.match_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposals_select_chat_access" ON public.match_proposals;
CREATE POLICY "proposals_select_chat_access" ON public.match_proposals
  FOR SELECT USING (public.can_access_match_chat(match_id, auth.uid()));

-- Realtime pour maj des cartes (accept/reject)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_proposals;
  END IF;
END $$;

-- ─── Helper : appliquer un transfert ────────────────────────

CREATE OR REPLACE FUNCTION public._apply_player_transfer(
  p_match_id UUID,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_player_id TEXT;
  v_to_side TEXT;
  v_from_side TEXT;
  v_attendee_id UUID;
  v_user_id UUID;
  v_existing RECORD;
BEGIN
  v_player_id := NULLIF(trim(COALESCE(p_payload->>'player_id', '')), '');
  v_to_side := upper(trim(COALESCE(p_payload->>'to_side', '')));
  v_from_side := upper(trim(COALESCE(p_payload->>'from_side', '')));

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Joueur manquant';
  END IF;
  IF v_to_side NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'Équipe cible invalide';
  END IF;
  IF v_from_side NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'Équipe source invalide';
  END IF;
  IF v_from_side = v_to_side THEN
    RAISE EXCEPTION 'Le joueur est déjà dans cette équipe';
  END IF;

  IF v_player_id LIKE 'guest:%' THEN
    BEGIN
      v_attendee_id := (substring(v_player_id from 7))::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Identifiant invité invalide';
    END;
    v_user_id := NULL;

    IF NOT EXISTS (
      SELECT 1 FROM public.match_attendees
      WHERE id = v_attendee_id AND match_id = p_match_id AND status = 'present'
    ) THEN
      RAISE EXCEPTION 'Joueur invité introuvable ou non présent';
    END IF;
  ELSE
    BEGIN
      v_user_id := v_player_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Identifiant joueur invalide';
    END;
    v_attendee_id := NULL;

    IF NOT EXISTS (
      SELECT 1 FROM public.match_attendees
      WHERE match_id = p_match_id AND user_id = v_user_id AND status = 'present'
    ) THEN
      RAISE EXCEPTION 'Joueur introuvable ou non présent';
    END IF;
  END IF;

  INSERT INTO public.match_compositions (match_id, formation_a, formation_b, updated_at)
  VALUES (p_match_id, 'auto', 'auto', now())
  ON CONFLICT (match_id) DO UPDATE SET updated_at = now();

  IF v_attendee_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.match_lineups
    WHERE match_id = p_match_id AND attendee_id = v_attendee_id;

    IF FOUND THEN
      IF v_existing.team_side <> v_from_side THEN
        RAISE EXCEPTION 'Le joueur n''est plus dans l''équipe %', v_from_side;
      END IF;
      UPDATE public.match_lineups
      SET team_side = v_to_side, slot_id = NULL, pos_x = NULL, pos_y = NULL
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO public.match_lineups (match_id, attendee_id, team_side, slot_id)
      VALUES (p_match_id, v_attendee_id, v_to_side, NULL);
    END IF;
  ELSE
    SELECT * INTO v_existing
    FROM public.match_lineups
    WHERE match_id = p_match_id AND user_id = v_user_id;

    IF FOUND THEN
      IF v_existing.team_side <> v_from_side THEN
        RAISE EXCEPTION 'Le joueur n''est plus dans l''équipe %', v_from_side;
      END IF;
      UPDATE public.match_lineups
      SET team_side = v_to_side, slot_id = NULL, pos_x = NULL, pos_y = NULL
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO public.match_lineups (match_id, user_id, team_side, slot_id)
      VALUES (p_match_id, v_user_id, v_to_side, NULL);
    END IF;
  END IF;
END;
$$;

-- ─── Créer une proposition + message action ─────────────────

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

  IF p_proposal_type NOT IN ('guest_add', 'player_transfer', 'team_split') THEN
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

  -- Valider / normaliser le payload selon le type
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
  END IF;

  -- Si l'orga propose, auto-accepter
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
    END IF;
  END IF;

  INSERT INTO public.messages (match_id, sender_id, content, type, proposal_id)
  VALUES (p_match_id, auth.uid(), v_content, 'action', v_proposal_id)
  RETURNING id INTO v_message_id;

  -- Notifier l'orga s'il n'est pas le proposeur
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

GRANT EXECUTE ON FUNCTION public.create_match_proposal(UUID, TEXT, JSONB, TEXT) TO authenticated;

-- ─── Accepter / refuser (orga) ──────────────────────────────

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
    END IF;
  END IF;

  UPDATE public.match_proposals
  SET
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    resolved_by = auth.uid(),
    resolved_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO v_result;

  -- Notifier le proposeur
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

GRANT EXECUTE ON FUNCTION public.resolve_match_proposal(UUID, BOOLEAN) TO authenticated;

-- ─── Notifications chat : body lisible pour action ──────────

CREATE OR REPLACE FUNCTION public.notify_match_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_sender_name TEXT;
  v_attendee RECORD;
  v_body TEXT;
  v_title TEXT;
BEGIN
  IF NEW.type = 'system' OR NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, title, organizer_id INTO v_match FROM public.matches WHERE id = NEW.match_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;

  v_body := LEFT(NEW.content, 120);
  IF LENGTH(NEW.content) > 120 THEN
    v_body := v_body || '…';
  END IF;

  v_title := COALESCE(v_sender_name, 'Quelqu''un') || ' · ' || COALESCE(v_match.title, 'Chat match');

  FOR v_attendee IN
    SELECT ma.user_id
    FROM public.match_attendees ma
    WHERE ma.match_id = NEW.match_id
      AND ma.user_id != NEW.sender_id
      AND ma.status IN ('present', 'maybe', 'waitlist', 'pending')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_attendee.user_id,
      'chat_message',
      v_title,
      v_body,
      jsonb_build_object(
        'matchId', NEW.match_id::text,
        'messageId', NEW.id::text,
        'chat', 'true'
      )
    );
  END LOOP;

  -- Orga hors effectif : notifié aussi pour les messages action
  IF NEW.type = 'action'
     AND v_match.organizer_id IS NOT NULL
     AND v_match.organizer_id IS DISTINCT FROM NEW.sender_id
     AND NOT EXISTS (
       SELECT 1 FROM public.match_attendees ma
       WHERE ma.match_id = NEW.match_id
         AND ma.user_id = v_match.organizer_id
         AND ma.status IN ('present', 'maybe', 'waitlist', 'pending')
     )
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_match.organizer_id,
      'chat_message',
      v_title,
      v_body,
      jsonb_build_object(
        'matchId', NEW.match_id::text,
        'messageId', NEW.id::text,
        'chat', 'true'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
