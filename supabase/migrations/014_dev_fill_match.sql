-- Migration 014 : outil dev — remplir un match avec des joueurs démo
-- Exécuter dans Supabase SQL Editor
-- Réservé à l'organisateur ; ne cible que les comptes démo (anouar+*@bhgroupe.fr)

DROP FUNCTION IF EXISTS public.dev_fill_match_attendees(UUID, INT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.dev_fill_match_attendees(
  p_match_id UUID,
  p_target_present INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_present INT;
  v_to_add INT;
  v_added INT := 0;
  v_profile RECORD;
  v_target INT;
BEGIN
  IF p_target_present IS NULL OR p_target_present < 1 THEN
    RAISE EXCEPTION 'Nombre de joueurs invalide';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match introuvable';
  END IF;

  IF v_match.organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Seul l''organisateur peut utiliser cet outil';
  END IF;

  IF v_match.status NOT IN ('upcoming', 'live') THEN
    RAISE EXCEPTION 'Match non modifiable';
  END IF;

  v_target := LEAST(p_target_present, v_match.max_players);

  SELECT COUNT(*)::INT INTO v_present
  FROM public.match_attendees
  WHERE match_id = p_match_id AND status = 'present';

  IF v_present >= v_target THEN
    RETURN jsonb_build_object(
      'added', 0,
      'present', v_present,
      'target', v_target,
      'message', 'Objectif déjà atteint'
    );
  END IF;

  v_to_add := v_target - v_present;

  FOR v_profile IN
    SELECT p.id, p.email, p.name
    FROM public.profiles p
    WHERE p.id != v_match.organizer_id
      AND p.email ~ '^anouar\+[0-9]+@bhgroupe\.fr$'
      AND NOT EXISTS (
        SELECT 1 FROM public.match_attendees ma
        WHERE ma.match_id = p_match_id AND ma.user_id = p.id AND ma.status = 'present'
      )
    ORDER BY p.email
    LIMIT v_to_add
  LOOP
    INSERT INTO public.match_attendees (match_id, user_id, status)
    VALUES (p_match_id, v_profile.id, 'present')
    ON CONFLICT (match_id, user_id) DO UPDATE SET status = 'present';

    v_added := v_added + 1;
  END LOOP;

  SELECT COUNT(*)::INT INTO v_present
  FROM public.match_attendees
  WHERE match_id = p_match_id AND status = 'present';

  RETURN jsonb_build_object(
    'added', v_added,
    'present', v_present,
    'target', v_target,
    'message', CASE
      WHEN v_added = 0 THEN 'Aucun joueur démo disponible. Lance node scripts/seed-demo-users.mjs'
      ELSE v_added || ' joueur(s) inscrit(s)'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_fill_match_attendees(UUID, INT) TO authenticated;

-- Recharge le cache API Supabase (si l'erreur "schema cache" persiste)
NOTIFY pgrst, 'reload schema';
