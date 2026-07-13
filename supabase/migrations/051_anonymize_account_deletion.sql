-- Preserve match history for other users when an account is deleted.
-- Anonymize the profile, remove personal data, delete auth access only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_active
  ON public.profiles (name)
  WHERE deleted_at IS NULL;

-- Stop cascading profile deletion when auth.users is removed.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Compte déjà supprimé';
  END IF;

  -- Personal data only — match/chat/stats rows keep the same profile id.
  DELETE FROM public.friend_requests
    WHERE from_user_id = uid OR to_user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.match_invite_suggestions
    WHERE suggested_user_id = uid OR suggested_by_user_id = uid;
  DELETE FROM public.social_posts WHERE author_id = uid;
  DELETE FROM public.tournament_registrations WHERE user_id = uid;
  DELETE FROM public.match_chat_reads WHERE user_id = uid;
  DELETE FROM public.chat_push_cooldown WHERE user_id = uid;

  UPDATE public.profiles SET
    name = 'Joueur supprimé',
    email = 'deleted+' || uid::text || '@kojiro.app',
    avatar_url = NULL,
    bio = NULL,
    push_token = NULL,
    latitude = NULL,
    longitude = NULL,
    city = '—',
    stats = '{
      "matchesPlayed": 0, "goals": 0, "assists": 0,
      "wins": 0, "losses": 0, "draws": 0, "mvpCount": 0,
      "averageRating": 0, "fairPlayScore": 0, "averageDefensiveRating": 0,
      "shotsOnTarget": 0, "passAccuracy": 0, "minutesPlayed": 0
    }'::jsonb,
    badges = '[]'::jsonb,
    deleted_at = now(),
    updated_at = now()
  WHERE id = uid;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
