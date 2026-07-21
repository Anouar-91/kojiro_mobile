-- Migration 058 : rappels match planifiés (J-0 matin + H-2)
-- Prérequis : extension pg_net (push) déjà active via 017.
-- Activer pg_cron dans Supabase Dashboard → Database → Extensions si besoin.

CREATE TABLE IF NOT EXISTS public.match_reminder_sent (
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('day_of', 'h2')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_match_reminder_sent_kind
  ON public.match_reminder_sent (kind, sent_at);

ALTER TABLE public.match_reminder_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_reminder_sent_select_own" ON public.match_reminder_sent;
CREATE POLICY "match_reminder_sent_select_own"
  ON public.match_reminder_sent FOR SELECT
  USING (auth.uid() = user_id);

-- Envoie les rappels dus. Idempotent via match_reminder_sent.
-- Fuseau : Europe/Paris (date/heure match stockées sans timezone).
CREATE OR REPLACE FUNCTION public.send_scheduled_match_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now_paris TIMESTAMP;
  v_today DATE;
  v_paris_time TIME;
  v_match RECORD;
  v_attendee RECORD;
  v_kickoff TIMESTAMPTZ;
  v_time_label TEXT;
  v_inserted INT := 0;
BEGIN
  v_now_paris := now() AT TIME ZONE 'Europe/Paris';
  v_today := v_now_paris::date;
  v_paris_time := v_now_paris::time;

  -- ─── J-0 : le matin du jour du match (fenêtre 07:00–08:00 Paris) ───
  IF v_paris_time >= TIME '07:00' AND v_paris_time < TIME '08:00' THEN
    FOR v_match IN
      SELECT m.id, m.title, m.date, m.time
      FROM public.matches m
      WHERE m.status = 'upcoming'
        AND m.date = v_today
    LOOP
      v_time_label := to_char(v_match.time, 'HH24:MI');

      FOR v_attendee IN
        SELECT ma.user_id
        FROM public.match_attendees ma
        WHERE ma.match_id = v_match.id
          AND ma.user_id IS NOT NULL
          AND ma.status IN ('present', 'maybe')
          AND NOT EXISTS (
            SELECT 1
            FROM public.match_reminder_sent s
            WHERE s.match_id = v_match.id
              AND s.user_id = ma.user_id
              AND s.kind = 'day_of'
          )
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_attendee.user_id,
          'match_reminder',
          'C''est aujourd''hui ⚽',
          '« ' || v_match.title || ' » à ' || v_time_label || '. Confirme ta présence si besoin.',
          jsonb_build_object(
            'matchId', v_match.id::text,
            'reminder', 'day_of'
          )
        );

        INSERT INTO public.match_reminder_sent (match_id, user_id, kind)
        VALUES (v_match.id, v_attendee.user_id, 'day_of');

        v_inserted := v_inserted + 1;
      END LOOP;
    END LOOP;
  END IF;

  -- ─── H-2 : coup d'envoi dans ~2 h (fenêtre 1 h 45 – 2 h 15) ───
  FOR v_match IN
    SELECT m.id, m.title, m.date, m.time
    FROM public.matches m
    WHERE m.status = 'upcoming'
  LOOP
    v_kickoff := ((v_match.date + v_match.time) AT TIME ZONE 'Europe/Paris');

    IF v_kickoff < now() + INTERVAL '105 minutes'
       OR v_kickoff > now() + INTERVAL '135 minutes' THEN
      CONTINUE;
    END IF;

    v_time_label := to_char(v_match.time, 'HH24:MI');

    FOR v_attendee IN
      SELECT ma.user_id
      FROM public.match_attendees ma
      WHERE ma.match_id = v_match.id
        AND ma.user_id IS NOT NULL
        AND ma.status IN ('present', 'maybe')
        AND NOT EXISTS (
          SELECT 1
          FROM public.match_reminder_sent s
          WHERE s.match_id = v_match.id
            AND s.user_id = ma.user_id
            AND s.kind = 'h2'
        )
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_attendee.user_id,
        'match_reminder',
        'Dans 2 heures ⚽',
        '« ' || v_match.title || ' » commence à ' || v_time_label || '. Prépare-toi !',
        jsonb_build_object(
          'matchId', v_match.id::text,
          'reminder', 'h2'
        )
      );

      INSERT INTO public.match_reminder_sent (match_id, user_id, kind)
      VALUES (v_match.id, v_attendee.user_id, 'h2');

      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.send_scheduled_match_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_scheduled_match_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.send_scheduled_match_reminders() TO service_role;

-- Planification toutes les 15 minutes (si pg_cron est disponible)
DO $ext$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron non disponible : active-le dans Dashboard → Extensions, puis rejoue le bloc cron ci-dessous.';
END;
$ext$;

DO $cronsetup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('kojiro-match-reminders');
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- job absent
    END;

    PERFORM cron.schedule(
      'kojiro-match-reminders',
      '*/15 * * * *',
      $job$SELECT public.send_scheduled_match_reminders()$job$
    );
    RAISE NOTICE 'Cron kojiro-match-reminders planifié (*/15).';
  ELSE
    RAISE NOTICE 'Cron non planifié (pg_cron absent).';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Impossible de planifier le cron : %. Active pg_cron puis : SELECT cron.schedule(''kojiro-match-reminders'', ''*/15 * * * *'', ''SELECT public.send_scheduled_match_reminders()'');', SQLERRM;
END;
$cronsetup$;

NOTIFY pgrst, 'reload schema';
