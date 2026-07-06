-- Migration 007 : formats de match flexibles (ex. 6v6, 9v9)
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_format_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_format_check
  CHECK (format >= 2 AND format <= 15);
