import { mapDbMatchToMatch } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { AttendanceStatus, Match, MatchFormat } from '@/types';

const MATCH_SELECT = `
  *,
  match_attendees ( id, match_id, user_id, status, team_id )
`;

export async function fetchMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDbMatchToMatch);
}

export async function fetchMatchById(id: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapDbMatchToMatch(data);
}

export interface CreateMatchInput {
  title: string;
  format: MatchFormat;
  date: string;
  time: string;
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  pricePerPlayer: number;
  description?: string;
  organizerId: string;
}

export async function createMatch(input: CreateMatchInput): Promise<Match> {
  const maxPlayers = input.format === 5 ? 10 : input.format === 7 ? 14 : 22;

  const { data: match, error } = await supabase
    .from('matches')
    .insert({
      title: input.title || `Foot à ${input.format}`,
      format: input.format,
      date: input.date,
      time: input.time,
      location_name: input.locationName,
      location_address: input.locationAddress,
      latitude: input.latitude,
      longitude: input.longitude,
      price_per_player: input.pricePerPlayer,
      description: input.description ?? null,
      organizer_id: input.organizerId,
      max_players: maxPlayers,
      status: 'upcoming',
    })
    .select(MATCH_SELECT)
    .single();

  if (error || !match) throw new Error(error?.message ?? 'Erreur création match');

  await supabase.from('match_attendees').insert({
    match_id: match.id,
    user_id: input.organizerId,
    status: 'present',
  });

  const refreshed = await fetchMatchById(match.id);
  if (!refreshed) throw new Error('Match créé mais introuvable');
  return refreshed;
}

export async function upsertAttendance(
  matchId: string,
  userId: string,
  status: AttendanceStatus
): Promise<void> {
  const { error } = await supabase.from('match_attendees').upsert(
    { match_id: matchId, user_id: userId, status },
    { onConflict: 'match_id,user_id' }
  );
  if (error) throw new Error(error.message);
}
