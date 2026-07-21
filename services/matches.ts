import { mapDbMatchToMatch } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { fetchFriendIds } from '@/services/friends';
import { AttendanceStatus, Match, MatchFormat, MatchVisibility, Position } from '@/types';
import {
  canSetPresent,
  isMatchFull,
  validateAttendanceChange,
} from '@/utils/matchAttendance';
import { isMatchPendingStats, isMatchUnfinishedOpen } from '@/utils/matchDates';

const MATCH_SELECT = `
  *,
  match_attendees ( id, match_id, user_id, guest_name, guest_position, status, team_id, created_at )
`;

export async function fetchMatches(userId?: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  const matches = (data ?? []).map(mapDbMatchToMatch).filter((m) => {
    // Garder terminés / en stats / annulés, et tous les upcoming/live
    // (y compris après l'heure de début, pour pouvoir ouvrir les stats).
    if (isMatchPendingStats(m) || m.status === 'completed' || m.status === 'cancelled') {
      return true;
    }
    return isMatchUnfinishedOpen(m);
  });

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

export async function updateMatchSubstitutes(
  matchId: string,
  substitutesPerTeam: number
): Promise<void> {
  const { error } = await supabase.rpc('organizer_update_substitutes', {
    p_match_id: matchId,
    p_substitutes_per_team: substitutesPerTeam,
  });
  if (error) throw new Error(error.message);
}

export async function upsertAttendance(
  matchId: string,
  userId: string,
  status: AttendanceStatus
): Promise<void> {
  const match = await fetchMatchById(matchId);
  if (match) {
    validateAttendanceChange(match, userId, status);
  }
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

  if (status === 'present' && match && !canSetPresent(match, userId)) {
    throw new Error(`Ce match est complet (${match.maxPlayers} places). Rejoins la liste d'attente.`);
  }

  if (status === 'waitlist') {
    if (!match || !isMatchFull(match)) {
      throw new Error('Le match n\'est pas complet, tu peux t\'inscrire directement.');
    }
    const mine = match.attendees.find((a) => a.userId === userId);
    if (mine?.status === 'present') {
      throw new Error('Tu es déjà inscrit comme présent.');
    }
  }

  const { data: existing, error: selectError } = await supabase
    .from('match_attendees')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (selectError) throw new Error(selectError.message);

  if (existing) {
    const { error } = await supabase
      .from('match_attendees')
      .update({ status })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('match_attendees').insert({
      match_id: matchId,
      user_id: userId,
      status,
    });
    if (error) throw new Error(error.message);
  }
}

export async function closeMatchRecruitment(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('close_match_recruitment', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

export async function reopenMatchRecruitment(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_match_recruitment', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

export async function cancelMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_match', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

export async function closeMatchSimple(
  matchId: string,
  teamAScore?: number | null,
  teamBScore?: number | null
): Promise<void> {
  const { error } = await supabase.rpc('close_match_simple', {
    p_match_id: matchId,
    p_team_a_score: teamAScore ?? null,
    p_team_b_score: teamBScore ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function removeAttendeeByOrganizer(matchId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('organizer_remove_attendee', {
    p_match_id: matchId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function addGuestToMatch(
  matchId: string,
  guestName: string,
  guestPosition?: Position | null
): Promise<string> {
  const { data, error } = await supabase.rpc('organizer_add_guest', {
    p_match_id: matchId,
    p_guest_name: guestName.trim(),
    p_guest_position: guestPosition ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function removeAttendeeById(attendeeId: string): Promise<void> {
  const { error } = await supabase.rpc('organizer_remove_attendee_by_id', {
    p_attendee_id: attendeeId,
  });
  if (error) throw new Error(error.message);
}

export interface PlayerMatchStat {
  userId: string;
  team: 'A' | 'B';
  goals: number;
  assists: number;
  rating: number;
  fairPlay: number;
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
      fair_play: p.fairPlay,
      mvp: p.mvp,
    })),
  });

  if (error) throw new Error(error.message);
}

export interface RealtimeAttendeeRow {
  id: string;
  match_id: string;
  user_id: string | null;
  guest_name?: string | null;
  guest_position?: string | null;
  status: string;
  team_id?: string | null;
  created_at: string;
}

export function subscribeToMatchAttendees(callbacks: {
  onUpsert: (row: RealtimeAttendeeRow) => void;
  onDelete: (row: { match_id: string; attendee_id: string }) => void;
}): () => void {
  const channel = supabase
    .channel('realtime:match_attendees')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'match_attendees' },
      (payload) => callbacks.onUpsert(payload.new as RealtimeAttendeeRow)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'match_attendees' },
      (payload) => callbacks.onUpsert(payload.new as RealtimeAttendeeRow)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'match_attendees' },
      (payload) => {
        const old = payload.old as Partial<RealtimeAttendeeRow>;
        if (old.match_id && old.id) {
          callbacks.onDelete({ match_id: old.match_id, attendee_id: old.id });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToMatches(callbacks: {
  onChange: (matchId: string) => void;
  onInsert: () => void;
}): () => void {
  const channel = supabase
    .channel('realtime:matches')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'matches' },
      () => callbacks.onInsert()
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches' },
      (payload) => {
        const row = payload.new as { id?: string };
        if (row.id) callbacks.onChange(row.id);
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'matches' },
      (payload) => {
        const row = payload.old as { id?: string };
        if (row.id) callbacks.onChange(row.id);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
