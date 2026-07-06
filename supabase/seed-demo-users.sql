-- Seed 20 profils démo : anouar+1@bhgroupe.fr … anouar+20@bhgroupe.fr
-- Mot de passe : Kojiro2026!
-- Exécuter dans Supabase SQL Editor (nécessite droits sur auth.users)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_id UUID;
  v_email TEXT;
  v_names TEXT[] := ARRAY[
    'Youssef Benali', 'Mehdi Cherif', 'Karim Mansouri', 'Lucas Petit', 'Thomas Dupont',
    'Sophie Bernard', 'Alex Rivera', 'Emma Dubois', 'Kevin Ndiaye', 'Marc Leroy',
    'Hugo Martin', 'Inès Moreau', 'Rayan Bouzid', 'Claire Fontaine', 'Nassim Hamdi',
    'Julie Lambert', 'Omar Soltani', 'Pierre Girard', 'Sara El Amrani', 'Antoine Rousseau'
  ];
  v_positions TEXT[] := ARRAY['FWD','MID','DEF','GK','FWD','MID','DEF','MID','FWD','GK','DEF','MID','FWD','DEF','MID','FWD','DEF','GK','MID','FWD'];
  v_feet TEXT[] := ARRAY['Droit','Gauche','Droit','Droit','Droit','Ambidextre','Gauche','Gauche','Droit','Droit','Droit','Droit','Gauche','Droit','Droit','Droit','Gauche','Droit','Ambidextre','Droit'];
  v_cities TEXT[] := ARRAY['Paris','Lyon','Marseille','Paris','Paris','Lille','Paris','Bordeaux','Paris','Nantes','Toulouse','Paris','Lyon','Paris','Marseille','Strasbourg','Paris','Nice','Paris','Rennes'];
  v_levels INT[] := ARRAY[14,11,10,13,15,12,9,16,13,14,8,11,12,10,14,9,11,12,15,10];
  v_xp INT[] := ARRAY[1650,980,870,1420,1880,1150,720,2100,1380,1590,540,1020,1200,800,1700,690,950,1100,1820,830];
  v_ratings DECIMAL[] := ARRAY[4.7,4.3,4.1,4.6,4.8,4.4,4.0,4.9,4.5,4.7,3.9,4.2,4.4,4.0,4.6,4.1,4.3,4.4,4.7,4.2];
  i INT;
BEGIN
  FOR i IN 1..20 LOOP
    v_email := 'anouar+' || i || '@bhgroupe.fr';

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      SELECT id INTO v_id FROM auth.users WHERE email = v_email;
      RAISE NOTICE 'Existe déjà: %', v_email;
    ELSE
      v_id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token, is_super_admin
      ) VALUES (
        v_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        v_email,
        crypt('Kojiro2026!', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', v_names[i]),
        now(), now(), '', '', '', '', false
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_id, v_id,
        jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
        'email', v_id::text,
        now(), now(), now()
      );

      RAISE NOTICE 'Créé: %', v_email;
    END IF;

    UPDATE public.profiles SET
      name = v_names[i],
      position = v_positions[i],
      foot = v_feet[i],
      city = v_cities[i],
      level = v_levels[i],
      xp = v_xp[i],
      xp_to_next_level = 1000 + v_levels[i] * 200,
      rating = v_ratings[i],
      avatar_url = 'https://i.pravatar.cc/150?u=' || replace(v_email, '+', '%2B'),
      bio = 'Joueur Kojiro — ' || v_positions[i] || ' à ' || v_cities[i],
      stats = jsonb_build_object(
        'matchesPlayed', 10 + v_levels[i] * 3,
        'goals', v_levels[i] * 2,
        'assists', v_levels[i],
        'wins', (10 + v_levels[i] * 3) * 55 / 100,
        'losses', (10 + v_levels[i] * 3) * 30 / 100,
        'draws', (10 + v_levels[i] * 3) * 15 / 100,
        'mvpCount', v_levels[i] / 3,
        'averageRating', v_ratings[i],
        'fairPlayScore', 90,
        'shotsOnTarget', v_levels[i] * 5,
        'passAccuracy', 70 + v_levels[i],
        'minutesPlayed', (10 + v_levels[i] * 3) * 70
      )
    WHERE id = v_id;

    IF NOT FOUND THEN
      INSERT INTO public.profiles (id, email, name, position, foot, city, level, xp, rating, avatar_url, bio)
      VALUES (v_id, v_email, v_names[i], v_positions[i], v_feet[i], v_cities[i], v_levels[i], v_xp[i], v_ratings[i],
        'https://i.pravatar.cc/150?u=' || replace(v_email, '+', '%2B'),
        'Joueur Kojiro — ' || v_positions[i] || ' à ' || v_cities[i]);
    END IF;
  END LOOP;
END $$;
