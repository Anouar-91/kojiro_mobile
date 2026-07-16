-- Corrige les matchs créés avec l'année 2027 au lieu de 2026
-- (bug DateTimePicker / horloge simulateur : l'UI n'affichait pas l'année).

UPDATE public.matches
SET date = (date - INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM date) = 2027;

UPDATE public.match_results
SET played_at = (played_at - INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM played_at) = 2027;

UPDATE public.tournaments
SET
  start_date = (start_date - INTERVAL '1 year')::date,
  end_date = (end_date - INTERVAL '1 year')::date
WHERE EXTRACT(YEAR FROM start_date) = 2027
   OR EXTRACT(YEAR FROM end_date) = 2027;
