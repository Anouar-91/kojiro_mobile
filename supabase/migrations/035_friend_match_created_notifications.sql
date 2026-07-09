-- Migration 035 : notifier les amis quand un match est créé

CREATE OR REPLACE FUNCTION public.notify_friends_on_match_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_organizer_name TEXT;
  v_friend_id UUID;
BEGIN
  SELECT name INTO v_organizer_name
  FROM public.profiles
  WHERE id = NEW.organizer_id;

  FOR v_friend_id IN
    SELECT CASE
      WHEN fr.from_user_id = NEW.organizer_id THEN fr.to_user_id
      ELSE fr.from_user_id
    END
    FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND (fr.from_user_id = NEW.organizer_id OR fr.to_user_id = NEW.organizer_id)
  LOOP
    IF v_friend_id = NEW.organizer_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_friend_id,
      'friend_match_created',
      'Nouveau match',
      COALESCE(v_organizer_name, 'Un ami') || ' a créé « ' || NEW.title || ' »',
      jsonb_build_object(
        'matchId', NEW.id::text,
        'organizerId', NEW.organizer_id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friends_on_match_created ON public.matches;
CREATE TRIGGER trg_notify_friends_on_match_created
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friends_on_match_created();

NOTIFY pgrst, 'reload schema';
