-- Migration 010 : position GPS des joueurs
-- Exécuter dans Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
