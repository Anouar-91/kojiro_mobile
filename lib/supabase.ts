import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Kojiro] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export type DbProfile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  position: string;
  foot: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  rating: number;
  city: string;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
  stats: Record<string, number>;
  badges: Array<{ id: string; name: string; icon: string; description: string; earned_at: string }>;
  created_at: string;
};

export type DbMatch = {
  id: string;
  title: string;
  format: number;
  substitutes_per_team: number;
  date: string;
  time: string;
  location_name: string;
  location_address: string;
  latitude: number;
  longitude: number;
  price_per_player: number;
  description: string | null;
  organizer_id: string;
  max_players: number;
  visibility: string;
  status: string;
  image_url: string | null;
  tournament_id: string | null;
  created_at: string;
  match_attendees?: DbAttendee[];
};

export type DbAttendee = {
  id: string;
  match_id: string;
  user_id: string | null;
  guest_name: string | null;
  status: string;
  team_id: string | null;
  created_at?: string;
};

export type DbMessage = {
  id: string;
  match_id: string;
  sender_id: string | null;
  content: string;
  type: string;
  created_at: string;
};

export type DbNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, string> | null;
  created_at: string;
};
