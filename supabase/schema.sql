-- Kojiro — Schéma Supabase v1
-- Exécuter dans Supabase Dashboard → SQL Editor → Run

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Profiles ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  position TEXT NOT NULL DEFAULT 'MID' CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  foot TEXT NOT NULL DEFAULT 'Droit' CHECK (foot IN ('Gauche', 'Droit', 'Ambidextre')),
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  xp_to_next_level INT NOT NULL DEFAULT 1000,
  rating DECIMAL(3,1) NOT NULL DEFAULT 4.0,
  city TEXT NOT NULL DEFAULT 'Paris',
  bio TEXT,
  stats JSONB NOT NULL DEFAULT '{
    "matchesPlayed": 0, "goals": 0, "assists": 0,
    "wins": 0, "losses": 0, "draws": 0, "mvpCount": 0,
    "averageRating": 4.0, "fairPlayScore": 90, "averageDefensiveRating": 3.0,
    "shotsOnTarget": 0, "passAccuracy": 0, "minutesPlayed": 0
  }'::jsonb,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Matches ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  format INT NOT NULL CHECK (format IN (5, 7, 11)),
  date DATE NOT NULL,
  time TIME NOT NULL,
  location_name TEXT NOT NULL,
  location_address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  price_per_player DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_players INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
  image_url TEXT,
  tournament_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Attendees ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('present', 'absent', 'maybe', 'pending')),
  team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

-- ─── Messages (chat) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Auto-create profile on signup ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Updated_at trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Matches
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches_insert_auth" ON public.matches FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "matches_update_organizer" ON public.matches FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "matches_delete_organizer" ON public.matches FOR DELETE USING (auth.uid() = organizer_id);

-- Attendees
CREATE POLICY "attendees_select_all" ON public.match_attendees FOR SELECT USING (true);
CREATE POLICY "attendees_insert_own" ON public.match_attendees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attendees_update_own" ON public.match_attendees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "attendees_delete_own" ON public.match_attendees FOR DELETE USING (auth.uid() = user_id);

-- Messages (lecture/écriture : organisateur + inscrits present/maybe/waitlist/pending)
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

CREATE POLICY "messages_select_participants" ON public.messages
  FOR SELECT
  USING (public.can_access_match_chat(match_id, auth.uid()));
CREATE POLICY "messages_insert_participants" ON public.messages
  FOR INSERT
  WITH CHECK (
    public.can_access_match_chat(match_id, auth.uid())
    AND (auth.uid() = sender_id OR sender_id IS NULL)
  );

-- Notifications
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ─── Realtime (chat) ────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_attendees;

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_attendees_match ON public.match_attendees(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_match ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
