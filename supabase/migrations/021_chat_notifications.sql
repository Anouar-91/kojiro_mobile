-- Migration 021 : notifications chat (in-app + push avec cooldown 15 min)
-- Exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.match_chat_reads (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id)
);

CREATE TABLE IF NOT EXISTS public.chat_push_cooldown (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  last_push_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id)
);

ALTER TABLE public.match_chat_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_push_cooldown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_chat_reads_own" ON public.match_chat_reads;
CREATE POLICY "match_chat_reads_own" ON public.match_chat_reads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_push_cooldown_own" ON public.chat_push_cooldown;
CREATE POLICY "chat_push_cooldown_own" ON public.chat_push_cooldown
  FOR SELECT USING (auth.uid() = user_id);

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

  SELECT id, title INTO v_match FROM public.matches WHERE id = NEW.match_id;
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_chat_message ON public.messages;
CREATE TRIGGER trg_notify_match_chat_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_match_chat_message();

CREATE OR REPLACE FUNCTION public.send_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_push_token TEXT;
  v_match_id UUID;
  v_last_push TIMESTAMPTZ;
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

  IF NEW.type = 'chat_message' AND NEW.data ? 'matchId' THEN
    v_match_id := (NEW.data->>'matchId')::uuid;

    SELECT last_push_at INTO v_last_push
    FROM public.chat_push_cooldown
    WHERE user_id = NEW.user_id AND match_id = v_match_id;

    IF v_last_push IS NOT NULL AND v_last_push > now() - interval '15 minutes' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.chat_push_cooldown (user_id, match_id, last_push_at)
    VALUES (NEW.user_id, v_match_id, now())
    ON CONFLICT (user_id, match_id) DO UPDATE
      SET last_push_at = EXCLUDED.last_push_at;
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
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
