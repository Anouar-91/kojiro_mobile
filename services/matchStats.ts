import { guestPlayerId, parseGuestPlayerId } from '@/utils/guestAttendees';
import { supabase } from '@/lib/supabase';
import {
  CaptainPlayerStatInput,
  DEFAULT_DEFENSIVE_RATING,
  DEFAULT_FAIR_PLAY_RATING,
  DEFAULT_GLOBAL_RATING,
  FinalizePlayerStat,
  MatchMvpTally,
  MatchMvpVote,
  MatchStatsState,
  RosterEntry,
} from '@/types/matchStats';

function mapStatsState(raw: Record<string, unknown>): MatchStatsState {
  return {
    matchId: raw.matchId as string,
    status: raw.status as string,
    teamAScore: raw.teamAScore != null ? Number(raw.teamAScore) : null,
    teamBScore: raw.teamBScore != null ? Number(raw.teamBScore) : null,
    winningSide: raw.winningSide as MatchStatsState['winningSide'],
    statsOpenedAt: (raw.statsOpenedAt as string) ?? null,
    organizerId: raw.organizerId as string,
    captainAId: (raw.captainAId as string) ?? null,
    captainBId: (raw.captainBId as string) ?? null,
    entries: ((raw.entries as unknown[]) ?? []).map((e) => {
      const entry = e as Record<string, unknown>;
      return {
        entryId: entry.entryId as string,
        userId: (entry.userId as string) ?? null,
        attendeeId: (entry.attendeeId as string) ?? null,
        teamSide: entry.teamSide as MatchStatsState['entries'][0]['teamSide'],
        selfGoals: entry.selfGoals != null ? Number(entry.selfGoals) : null,
        selfAssists: entry.selfAssists != null ? Number(entry.selfAssists) : null,
        selfGlobalRating: entry.selfGlobalRating != null ? Number(entry.selfGlobalRating) : null,
        selfDefRating: entry.selfDefRating != null ? Number(entry.selfDefRating) : null,
        selfFairPlay: entry.selfFairPlay != null ? Number(entry.selfFairPlay) : null,
        selfSubmittedAt: (entry.selfSubmittedAt as string) ?? null,
        captainGoals: entry.captainGoals != null ? Number(entry.captainGoals) : null,
        captainAssists: entry.captainAssists != null ? Number(entry.captainAssists) : null,
        captainGlobalRating: entry.captainGlobalRating != null ? Number(entry.captainGlobalRating) : null,
        captainDefRating: entry.captainDefRating != null ? Number(entry.captainDefRating) : null,
        captainFairPlay: entry.captainFairPlay != null ? Number(entry.captainFairPlay) : null,
        captainUpdatedAt: (entry.captainUpdatedAt as string) ?? null,
        proposedGoals: Number(entry.proposedGoals ?? 0),
        proposedAssists: Number(entry.proposedAssists ?? 0),
        proposedGlobalRating: Number(entry.proposedGlobalRating ?? DEFAULT_GLOBAL_RATING),
        proposedDefRating: Number(entry.proposedDefRating ?? DEFAULT_DEFENSIVE_RATING),
        proposedFairPlay: Number(entry.proposedFairPlay ?? DEFAULT_FAIR_PLAY_RATING),
        name: entry.name as string,
        isGuest: Boolean(entry.isGuest),
      };
    }),
    teamValidations: ((raw.teamValidations as unknown[]) ?? []).map((v) => {
      const val = v as Record<string, unknown>;
      return {
        teamSide: val.teamSide as MatchStatsState['teamValidations'][0]['teamSide'],
        validatedBy: val.validatedBy as string,
        validatedAt: val.validatedAt as string,
      };
    }),
    mvpVotes: ((raw.mvpVotes as unknown[]) ?? []).map((v) => {
      const vote = v as Record<string, unknown>;
      return {
        voterId: vote.voterId as string,
        votedForId: (vote.votedForId as string) ?? null,
        votedForAttendeeId: (vote.votedForAttendeeId as string) ?? null,
      };
    }),
    mvpTally: ((raw.mvpTally as unknown[]) ?? []).map((t) => {
      const tally = t as Record<string, unknown>;
      return {
        userId: (tally.userId as string) ?? null,
        attendeeId: (tally.attendeeId as string) ?? null,
        votes: Number(tally.votes),
      };
    }),
    myCaptainSide: (raw.myCaptainSide as MatchStatsState['myCaptainSide']) ?? null,
  };
}

export async function fetchMatchStatsState(matchId: string): Promise<MatchStatsState> {
  const { data, error } = await supabase.rpc('get_match_stats_state', { p_match_id: matchId });
  if (error) throw new Error(error.message);
  return mapStatsState(data as Record<string, unknown>);
}

export async function openMatchStats(
  matchId: string,
  teamAScore: number,
  teamBScore: number,
  roster: RosterEntry[]
): Promise<void> {
  const { error } = await supabase.rpc('open_match_stats', {
    p_match_id: matchId,
    p_team_a_score: teamAScore,
    p_team_b_score: teamBScore,
    p_roster: roster.map((r) => ({
      user_id: r.userId ?? null,
      attendee_id: r.attendeeId ?? null,
      team: r.team,
    })),
  });
  if (error) throw new Error(error.message);
}

export async function updateMatchScore(
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<void> {
  const { error } = await supabase.rpc('update_match_score', {
    p_match_id: matchId,
    p_team_a_score: teamAScore,
    p_team_b_score: teamBScore,
  });
  if (error) throw new Error(error.message);
}

export async function submitMyMatchStats(
  matchId: string,
  goals: number,
  assists: number,
  mvpParticipantKey: string | null,
  globalRating: number = DEFAULT_GLOBAL_RATING,
  defRating: number = DEFAULT_DEFENSIVE_RATING,
  fairPlay: number = DEFAULT_FAIR_PLAY_RATING
): Promise<void> {
  const mvp = parseMvpParticipantKey(mvpParticipantKey);
  const { error } = await supabase.rpc('submit_my_match_stats', {
    p_match_id: matchId,
    p_goals: goals,
    p_assists: assists,
    p_mvp_user_id: mvp.userId ?? null,
    p_mvp_attendee_id: mvp.attendeeId ?? null,
    p_global_rating: globalRating,
    p_def_rating: defRating,
    p_fair_play: fairPlay,
  });
  if (error) throw new Error(error.message);
}

export async function captainSaveTeamStats(
  matchId: string,
  teamSide: 'A' | 'B',
  players: CaptainPlayerStatInput[],
  mvpParticipantKey: string | null
): Promise<void> {
  const mvp = parseMvpParticipantKey(mvpParticipantKey);
  const { error } = await supabase.rpc('captain_save_team_stats', {
    p_match_id: matchId,
    p_team_side: teamSide,
    p_players: players.map((p) => ({
      user_id: p.userId ?? null,
      attendee_id: p.attendeeId ?? null,
      goals: p.goals,
      assists: p.assists,
      global_rating: p.globalRating,
      def_rating: p.defRating,
      fair_play: p.fairPlay,
    })),
    p_mvp_user_id: mvp.userId ?? null,
    p_mvp_attendee_id: mvp.attendeeId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function finalizeMatchStats(
  matchId: string,
  playerStats: FinalizePlayerStat[],
  mvpParticipantKey?: string | null
): Promise<void> {
  const mvp = parseMvpParticipantKey(mvpParticipantKey ?? null);
  const { error } = await supabase.rpc('finalize_match_stats', {
    p_match_id: matchId,
    p_player_stats: playerStats.map((p) => ({
      user_id: p.userId ?? null,
      attendee_id: p.attendeeId ?? null,
      team: p.team,
      goals: p.goals,
      assists: p.assists,
      global_rating: p.globalRating,
      def_rating: p.defRating,
      fair_play: p.fairPlay,
    })),
    p_mvp_user_id: mvp.userId ?? null,
    p_mvp_attendee_id: mvp.attendeeId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function reopenMatchStats(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_match_stats', { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

export function subscribeToMatchStats(matchId: string, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };

  const channel = supabase
    .channel(`realtime:match_stats:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_stat_entries', filter: `match_id=eq.${matchId}` },
      debounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_mvp_votes', filter: `match_id=eq.${matchId}` },
      debounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_team_stat_validations', filter: `match_id=eq.${matchId}` },
      debounced
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      debounced
    )
    .subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}

export function parseMvpParticipantKey(
  key: string | null
): { userId?: string; attendeeId?: string } {
  if (!key) return {};
  const attendeeId = parseGuestPlayerId(key);
  if (attendeeId) return { attendeeId };
  return { userId: key };
}

export function mvpVoteTargetKey(vote: MatchMvpVote): string | null {
  if (vote.votedForId) return vote.votedForId;
  if (vote.votedForAttendeeId) return guestPlayerId(vote.votedForAttendeeId);
  return null;
}

export function mvpTallyTargetKey(tally: MatchMvpTally): string | null {
  if (tally.userId) return tally.userId;
  if (tally.attendeeId) return guestPlayerId(tally.attendeeId);
  return null;
}

export function getParticipantKey(entry: { userId: string | null; attendeeId: string | null }): string {
  if (entry.userId) return entry.userId;
  if (entry.attendeeId) return `guest:${entry.attendeeId}`;
  return '';
}

export function sumGoalsByTeam(
  entries: { teamSide: 'A' | 'B'; goals: number }[]
): { teamA: number; teamB: number } {
  return entries.reduce(
    (acc, e) => {
      if (e.teamSide === 'A') acc.teamA += e.goals;
      else acc.teamB += e.goals;
      return acc;
    },
    { teamA: 0, teamB: 0 }
  );
}

export interface GoalTotalsStatus {
  teamA: number;
  teamB: number;
  targetA: number;
  targetB: number;
  valid: boolean;
  teamAOk: boolean;
  teamBOk: boolean;
  messages: string[];
}

function formatGoalDelta(teamLabel: string, entered: number, target: number): string {
  const delta = target - entered;
  if (delta === 0) {
    return `${teamLabel} : ${entered}/${target} buts — OK`;
  }
  if (delta > 0) {
    return `${teamLabel} : ${entered}/${target} buts — il manque ${delta} but${delta > 1 ? 's' : ''}`;
  }
  const excess = Math.abs(delta);
  return `${teamLabel} : ${entered}/${target} buts — ${excess} but${excess > 1 ? 's' : ''} en trop`;
}

export function buildGoalTotalsStatus(
  entries: { teamSide: 'A' | 'B'; goals: number }[],
  targetA: number,
  targetB: number,
  teamLabels?: { teamA: string; teamB: string }
): GoalTotalsStatus {
  const { teamA, teamB } = sumGoalsByTeam(entries);
  const teamAOk = teamA === targetA;
  const teamBOk = teamB === targetB;
  const labelA = teamLabels?.teamA ?? 'Équipe A';
  const labelB = teamLabels?.teamB ?? 'Équipe B';
  return {
    teamA,
    teamB,
    targetA,
    targetB,
    valid: teamAOk && teamBOk,
    teamAOk,
    teamBOk,
    messages: [
      formatGoalDelta(labelA, teamA, targetA),
      formatGoalDelta(labelB, teamB, targetB),
    ],
  };
}

export function getMvpCandidates(
  entries: MatchStatsState['entries'],
  winningSide: MatchStatsState['winningSide']
): MatchStatsState['entries'] {
  if (winningSide === 'draw') return entries;
  return entries.filter((e) => e.teamSide === winningSide);
}

export function buildFinalizeStatsFromEntries(
  entries: MatchStatsState['entries'],
  overrides: Record<string, { goals: number; assists: number; globalRating: number; defRating: number; fairPlay: number }>
): FinalizePlayerStat[] {
  return entries.map((e) => {
    const key = getParticipantKey(e);
    const override = overrides[key];
    const stat = {
      goals: override?.goals ?? e.proposedGoals,
      assists: override?.assists ?? e.proposedAssists,
      globalRating: override?.globalRating ?? e.proposedGlobalRating,
      defRating: override?.defRating ?? e.proposedDefRating,
      fairPlay: override?.fairPlay ?? e.proposedFairPlay,
    };
    if (e.isGuest && e.attendeeId) {
      return {
        attendeeId: e.attendeeId,
        team: e.teamSide,
        ...stat,
      };
    }
    if (!e.userId || e.isGuest) {
      throw new Error(`Joueur invalide: ${e.name}`);
    }
    return {
      userId: e.userId,
      team: e.teamSide,
      ...stat,
    };
  });
}
