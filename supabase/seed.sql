-- Données de démo (optionnel)
-- Remplace YOUR_USER_ID par ton UUID Supabase (Authentication → Users)
-- Puis exécute dans SQL Editor

/*
INSERT INTO public.matches (
  title, format, date, time,
  location_name, location_address, latitude, longitude,
  price_per_player, description, organizer_id, max_players, status, image_url
) VALUES
(
  'Foot à 7 - Soirée entre amis', 7, '2026-07-05', '19:00',
  'City Stade Paris 13', '45 Rue du Charolais, 75012 Paris', 48.8323, 2.3865,
  8, 'Match convivial, niveau intermédiaire.', 'YOUR_USER_ID', 14, 'upcoming',
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=400'
),
(
  'Foot à 5 - Quick match', 5, '2026-07-04', '12:30',
  'Urban Soccer La Défense', '2 Place de la Défense, 92800 Puteaux', 48.8925, 2.2369,
  12, NULL, 'YOUR_USER_ID', 10, 'upcoming',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400'
);

INSERT INTO public.match_attendees (match_id, user_id, status)
SELECT id, 'YOUR_USER_ID', 'present' FROM public.matches;
*/
