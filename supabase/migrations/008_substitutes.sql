-- Migration 008 : remplaçants par équipe
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS substitutes_per_team INT NOT NULL DEFAULT 0
  CHECK (substitutes_per_team >= 0 AND substitutes_per_team <= 10);

-- Recalculer max_players pour les matchs existants (titulaires seulement, 0 remplaçant)
UPDATE public.matches
SET substitutes_per_team = 0
WHERE substitutes_per_team IS NULL;
