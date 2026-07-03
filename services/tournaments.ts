import { supabase } from '@/lib/supabase';
import { Tournament } from '@/types';

function mapTournament(row: {
  id: string;
  name: string;
  format: number;
  start_date: string;
  end_date: string;
  location_name: string;
  location_address: string;
  latitude: number;
  longitude: number;
  max_teams: number;
  registered_teams: number;
  prize: string | null;
  status: string;
  organizer_id: string | null;
}): Tournament {
  return {
    id: row.id,
    name: row.name,
    format: row.format as Tournament['format'],
    startDate: row.start_date,
    endDate: row.end_date,
    location: {
      name: row.location_name,
      address: row.location_address,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    maxTeams: row.max_teams,
    registeredTeams: row.registered_teams,
    prize: row.prize ?? undefined,
    status: row.status as Tournament['status'],
    organizerId: row.organizer_id ?? '',
  };
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTournament);
}

export async function registerForTournament(
  tournamentId: string,
  userId: string,
  teamName?: string
): Promise<void> {
  const { error } = await supabase.from('tournament_registrations').insert({
    tournament_id: tournamentId,
    user_id: userId,
    team_name: teamName ?? null,
  });

  if (error) {
    if (error.code === '23505') throw new Error('Tu es déjà inscrit à ce tournoi');
    throw new Error(error.message);
  }
}

export async function isRegisteredForTournament(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('tournament_registrations')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}

export async function fetchUserRegistrations(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('tournament_registrations')
    .select('tournament_id')
    .eq('user_id', userId);

  return (data ?? []).map((r) => r.tournament_id);
}
