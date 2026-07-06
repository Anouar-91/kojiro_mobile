-- Migration 009 : système d'amis + visibilité match
-- Exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id),
  CHECK (from_user_id != to_user_id)
);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'friends_only'));

CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests(from_user_id, status);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_requests_select_involved" ON public.friend_requests;
CREATE POLICY "friend_requests_select_involved" ON public.friend_requests
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "friend_requests_insert_own" ON public.friend_requests;
CREATE POLICY "friend_requests_insert_own" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "friend_requests_update_recipient" ON public.friend_requests;
CREATE POLICY "friend_requests_update_recipient" ON public.friend_requests
  FOR UPDATE USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- Notifs demandes d'amis
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
    OR (
      type = 'friend_request'
      AND data ? 'fromUserId'
      AND (data->>'fromUserId')::uuid = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_friend_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER friend_requests_updated_at
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_friend_request_updated_at();
