-- Migration 002 : notifications insert + bienvenue
-- Exécuter dans Supabase SQL Editor si pas déjà fait

DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Notification de bienvenue à la création du profil
CREATE OR REPLACE FUNCTION public.handle_welcome_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    NEW.id,
    'social',
    'Bienvenue sur Kojiro ! ⚽',
    'Crée ton premier match et invite tes amis à rejoindre.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_welcome_notification ON public.profiles;
CREATE TRIGGER on_profile_welcome_notification
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_welcome_notification();

-- Vue classement (XP)
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  id AS user_id,
  name,
  xp AS score,
  level,
  rating,
  RANK() OVER (ORDER BY xp DESC, level DESC) AS rank
FROM public.profiles
ORDER BY rank;

GRANT SELECT ON public.leaderboard TO anon, authenticated;
