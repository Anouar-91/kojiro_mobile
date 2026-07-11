-- Migration 042 : chat réservé aux participants du match (organisateur + inscrits actifs)

CREATE OR REPLACE FUNCTION public.can_access_match_chat(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.matches m
        WHERE m.id = p_match_id
          AND m.organizer_id = p_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.match_attendees ma
        WHERE ma.match_id = p_match_id
          AND ma.user_id = p_user_id
          AND ma.status IN ('present', 'maybe', 'waitlist', 'pending')
      )
    );
$$;

DROP POLICY IF EXISTS "messages_select_all" ON public.messages;
CREATE POLICY "messages_select_participants" ON public.messages
  FOR SELECT
  USING (public.can_access_match_chat(match_id, auth.uid()));

DROP POLICY IF EXISTS "messages_insert_auth" ON public.messages;
CREATE POLICY "messages_insert_participants" ON public.messages
  FOR INSERT
  WITH CHECK (
    public.can_access_match_chat(match_id, auth.uid())
    AND (auth.uid() = sender_id OR sender_id IS NULL)
  );
