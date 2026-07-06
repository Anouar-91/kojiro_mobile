import { mapDbMatchToMatch } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { fetchFriendIds } from '@/services/friends';
import { AttendanceStatus, Match, MatchFormat, MatchVisibility } from '@/types';

const MATCH_SELECT = `
  *,
  match_attendees ( id, match_id, user_id, status, team_id )
`;

export async function fetchMatches(userId?: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  const matches = (data ?? []).map(mapDbMatchToMatch);

  if (!userId) return matches;

  const friendIds = await fetchFriendIds(userId);
  const friendSet = new Set(friendIds);

  return matches.filter((m) => {
    if (m.visibility !== 'friends_only') return true;
    if (m.organizerId === userId) return true;
    if (friendSet.has(m.organizerId)) return true;
    return m.attendees.some((a) => a.userId === userId);
  });
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
  substitutesPerTeam?: number;
  date: string;
  time: string;
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  pricePerPlayer: number;
  description?: string;
  organizerId: string;
  visibility?: MatchVisibility;
}

export async function createMatch(input: CreateMatchInput): Promise<Match> {
  const playersPerTeam = input.format;
  const substitutesPerTeam = input.substitutesPerTeam ?? 0;
  const maxPlayers = (playersPerTeam + substitutesPerTeam) * 2;

  const { data: match, error } = await supabase
    .from('matches')
    .insert({
      title: input.title || `Foot ${playersPerTeam}v${playersPerTeam}`,
      format: playersPerTeam,
      substitutes_per_team: substitutesPerTeam,
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
      visibility: input.visibility ?? 'public',
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
  const match = await fetchMatchById(matchId);
  if (
    match?.visibility === 'friends_only' &&
    match.organizerId !== userId &&
    !match.attendees.some((a) => a.userId === userId)
  ) {
    const friendIds = await fetchFriendIds(userId);
    if (!friendIds.includes(match.organizerId)) {
      throw new Error('Ce match est réservé aux amis de l\'organisateur');
    }
  }

  const { error } = await supabase.from('match_attendees').upsert(
    { match_id: matchId, user_id: userId, status },
    { onConflict: 'match_id,user_id' }
  );
  if (error) throw new Error(error.message);
}

export interface PlayerMatchStat {
  userId: string;
  team: 'A' | 'B';
  goals: number;
  assists: number;
  rating: number;
  mvp: boolean;
}

export async function completeMatch(
  matchId: string,
  teamAScore: number,
  teamBScore: number,
  playerStats: PlayerMatchStat[]
): Promise<void> {
  const { error } = await supabase.rpc('complete_match', {
    p_match_id: matchId,
    p_team_a_score: teamAScore,
    p_team_b_score: teamBScore,
    p_player_stats: playerStats.map((p) => ({
      user_id: p.userId,
      team: p.team,
      goals: p.goals,
      assists: p.assists,
      rating: p.rating,
      mvp: p.mvp,
    })),
  });

  if (error) throw new Error(error.message);
}
