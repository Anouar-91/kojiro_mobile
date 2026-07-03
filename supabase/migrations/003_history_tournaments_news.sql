-- Migration 003 : historique, tournois, actualités
-- Exécuter dans Supabase SQL Editor

-- ─── Historique matchs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  played_at DATE NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('Victoire', 'Défaite', 'Nul')),
  score TEXT NOT NULL,
  rating DECIMAL(3,1) NOT NULL DEFAULT 4.0,
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  mvp BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Tournois ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  format INT NOT NULL CHECK (format IN (5, 7, 11)),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location_name TEXT NOT NULL,
  location_address TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL DEFAULT 48.8566,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 2.3522,
  max_teams INT NOT NULL,
  registered_teams INT NOT NULL DEFAULT 0,
  prize TEXT,
  status TEXT NOT NULL DEFAULT 'registration'
    CHECK (status IN ('registration', 'ongoing', 'completed')),
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

-- ─── Actualités ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Actu',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compteur inscriptions tournoi
CREATE OR REPLACE FUNCTION public.update_tournament_team_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tournaments
    SET registered_teams = registered_teams + 1
    WHERE id = NEW.tournament_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tournaments
    SET registered_teams = GREATEST(registered_teams - 1, 0)
    WHERE id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_tournament_registration ON public.tournament_registrations;
CREATE TRIGGER on_tournament_registration
  AFTER INSERT OR DELETE ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_tournament_team_count();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_results_select_own" ON public.match_results;
CREATE POLICY "match_results_select_own" ON public.match_results
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "match_results_insert_own" ON public.match_results;
CREATE POLICY "match_results_insert_own" ON public.match_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tournaments_select_all" ON public.tournaments;
CREATE POLICY "tournaments_select_all" ON public.tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournament_registrations_select_all" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_select_all" ON public.tournament_registrations FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournament_registrations_insert_own" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_insert_own" ON public.tournament_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tournament_registrations_delete_own" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_delete_own" ON public.tournament_registrations
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "news_select_all" ON public.news;
CREATE POLICY "news_select_all" ON public.news FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_match_results_user ON public.match_results(user_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);

-- ─── Données de démo ────────────────────────────────────────
INSERT INTO public.tournaments (name, format, start_date, end_date, location_name, location_address, max_teams, registered_teams, prize, status)
SELECT * FROM (VALUES
  ('Coupe Kojiro Paris 2026', 7, '2026-07-15'::date, '2026-07-20'::date, 'Complexe Sportif Charléty', '99 Blvd Kellermann, 75013 Paris', 16, 12, '500 € + Trophée', 'registration'),
  ('Summer Cup 5v5', 5, '2026-08-01'::date, '2026-08-03'::date, 'Urban Soccer Nation', '26 Rue des Rigoles, 75020 Paris', 8, 8, 'Maillots personnalisés', 'ongoing')
) AS v(name, format, start_date, end_date, location_name, location_address, max_teams, registered_teams, prize, status)
WHERE NOT EXISTS (SELECT 1 FROM public.tournaments LIMIT 1);

INSERT INTO public.news (title, summary, image_url, category, published_at)
SELECT * FROM (VALUES
  ('Coupe Kojiro : inscriptions ouvertes', 'Le plus grand tournoi amateur de Paris revient en juillet.', 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400', 'Tournoi', '2026-07-01T10:00:00'::timestamptz),
  ('Nouveau terrain à La Défense', 'Urban Soccer ouvre un 5ème terrain couvert.', 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400', 'Actu', '2026-06-28T14:00:00'::timestamptz)
) AS v(title, summary, image_url, category, published_at)
WHERE NOT EXISTS (SELECT 1 FROM public.news LIMIT 1);
