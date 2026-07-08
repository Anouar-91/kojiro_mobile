-- Migration 011 : composition d'équipes + formations
-- Exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.match_compositions (
  match_id UUID PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  formation_a TEXT NOT NULL DEFAULT 'auto',
  formation_b TEXT NOT NULL DEFAULT 'auto',
  validated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_lineups (
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_side TEXT NOT NULL CHECK (team_side IN ('A', 'B')),
  slot_id TEXT,
  pos_x DOUBLE PRECISION,
  pos_y DOUBLE PRECISION,
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_lineups_match ON public.match_lineups(match_id);

ALTER TABLE public.match_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_compositions_select" ON public.match_compositions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "match_lineups_select" ON public.match_lineups
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.save_match_composition(
  p_match_id UUID,
  p_formation_a TEXT,
  p_formation_b TEXT,
  p_lineups JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_row JSONB;
  v_user_id UUID;
  v_seen UUID[] := '{}';
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut modifier la composition';
  END IF;

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'Match déjà terminé';
  END IF;

  INSERT INTO public.match_compositions (match_id, formation_a, formation_b, validated_at, updated_at)
  VALUES (p_match_id, COALESCE(p_formation_a, 'auto'), COALESCE(p_formation_b, 'auto'), now(), now())
  ON CONFLICT (match_id) DO UPDATE SET
    formation_a = EXCLUDED.formation_a,
    formation_b = EXCLUDED.formation_b,
    validated_at = now(),
    updated_at = now();

  DELETE FROM public.match_lineups WHERE match_id = p_match_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_lineups)
  LOOP
    v_user_id := (v_row->>'user_id')::UUID;
    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;
    IF v_user_id = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := array_append(v_seen, v_user_id);

    INSERT INTO public.match_lineups (match_id, user_id, team_side, slot_id, pos_x, pos_y)
    VALUES (
      p_match_id,
      v_user_id,
      v_row->>'team_side',
      NULLIF(v_row->>'slot_id', ''),
      NULLIF(v_row->>'pos_x', '')::DOUBLE PRECISION,
      NULLIF(v_row->>'pos_y', '')::DOUBLE PRECISION
    )
    ON CONFLICT (match_id, user_id) DO UPDATE SET
      team_side = EXCLUDED.team_side,
      slot_id = EXCLUDED.slot_id,
      pos_x = EXCLUDED.pos_x,
      pos_y = EXCLUDED.pos_y;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut démarrer le match';
  END IF;
  IF v_match.status != 'upcoming' THEN
    RAISE EXCEPTION 'Le match ne peut pas être démarré';
  END IF;
  UPDATE public.matches SET status = 'live' WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_match_composition(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_match(UUID) TO authenticated;
