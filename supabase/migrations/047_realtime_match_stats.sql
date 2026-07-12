-- Migration 047 : realtime pour la saisie collaborative des stats

ALTER TABLE public.match_stat_entries REPLICA IDENTITY FULL;
ALTER TABLE public.match_mvp_votes REPLICA IDENTITY FULL;
ALTER TABLE public.match_team_stat_validations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_stat_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_stat_entries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_mvp_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_mvp_votes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_team_stat_validations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_team_stat_validations;
  END IF;
END $$;
