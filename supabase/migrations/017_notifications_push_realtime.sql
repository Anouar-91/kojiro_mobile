-- Migration 017 : push Expo + realtime notifications + RLS team_assigned
-- Exécuter dans Supabase SQL Editor
-- Prérequis : extension pg_net (Database → Extensions → pg_net)

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Realtime : nouvelles notifs visibles sans refresh manuel
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Autoriser l'organisateur à envoyer team_assigned depuis l'app
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR (
      type IN ('match_invite', 'match_reminder', 'team_assigned')
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

CREATE OR REPLACE FUNCTION public.send_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_push_token TEXT;
BEGIN
  SELECT push_token INTO v_push_token
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_push_token IS NULL OR v_push_token = '' THEN
    RETURN NEW;
  END IF;

  IF v_push_token NOT LIKE 'ExponentPushToken%' AND v_push_token NOT LIKE 'ExpoPushToken%' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'to', v_push_token,
      'title', NEW.title,
      'body', NEW.body,
      'sound', 'default',
      'data', COALESCE(NEW.data, '{}'::jsonb)
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Ne pas bloquer l'insertion in-app si le push échoue
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_push_for_notification ON public.notifications;
CREATE TRIGGER trg_send_push_for_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_for_notification();

NOTIFY pgrst, 'reload schema';
