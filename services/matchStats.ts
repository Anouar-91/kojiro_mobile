import { supabase } from '@/lib/supabase';
import {
  CaptainPlayerStatInput,
  DEFAULT_DEFENSIVE_RATING,
  DEFAULT_FAIR_PLAY_RATING,
  FinalizePlayerStat,
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
        selfDefRating: entry.selfDefRating != null ? Number(entry.selfDefRating) : null,
        selfFairPlay: entry.selfFairPlay != null ? Number(entry.selfFairPlay) : null,
        selfSubmittedAt: (entry.selfSubmittedAt as string) ?? null,
        captainGoals: entry.captainGoals != null ? Number(entry.captainGoals) : null,
        captainAssists: entry.captainAssists != null ? Number(entry.captainAssists) : null,
        captainDefRating: entry.captainDefRating != null ? Number(entry.captainDefRating) : null,
        captainFairPlay: entry.captainFairPlay != null ? Number(entry.captainFairPlay) : null,
        captainUpdatedAt: (entry.captainUpdatedAt as string) ?? null,
        proposedGoals: Number(entry.proposedGoals ?? 0),
        proposedAssists: Number(entry.proposedAssists ?? 0),
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
        votedForId: vote.votedForId as string,
      };
    }),
    mvpTally: ((raw.mvpTally as unknown[]) ?? []).map((t) => {
      const tally = t as Record<string, unknown>;
      return {
        userId: tally.userId as string,
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

export async function submitMyMatchStats(
  matchId: string,
  goals: number,
  assists: number,
  mvpUserId: string | null,
  defRating: number = DEFAULT_DEFENSIVE_RATING,
  fairPlay: number = DEFAULT_FAIR_PLAY_RATING
): Promise<void> {
  const { error } = await supabase.rpc('submit_my_match_stats', {
    p_match_id: matchId,
    p_goals: goals,
    p_assists: assists,
    p_mvp_user_id: mvpUserId,
    p_def_rating: defRating,
    p_fair_play: fairPlay,
  });
  if (error) throw new Error(error.message);
}

export async function captainSaveTeamStats(
  matchId: string,
  teamSide: 'A' | 'B',
  players: CaptainPlayerStatInput[],
  mvpUserId: string | null
): Promise<void> {
  const { error } = await supabase.rpc('captain_save_team_stats', {
    p_match_id: matchId,
    p_team_side: teamSide,
    p_players: players.map((p) => ({
      user_id: p.userId ?? null,
      attendee_id: p.attendeeId ?? null,
      goals: p.goals,
      assists: p.assists,
      def_rating: p.defRating,
      fair_play: p.fairPlay,
    })),
    p_mvp_user_id: mvpUserId,
  });
  if (error) throw new Error(error.message);
}

export async function finalizeMatchStats(
  matchId: string,
  playerStats: FinalizePlayerStat[],
  mvpUserId?: string | null
): Promise<void> {
  const { error } = await supabase.rpc('finalize_match_stats', {
    p_match_id: matchId,
    p_player_stats: playerStats.map((p) => ({
      user_id: p.userId,
      team: p.team,
      goals: p.goals,
      assists: p.assists,
      def_rating: p.defRating,
      fair_play: p.fairPlay,
    })),
    p_mvp_user_id: mvpUserId ?? null,
  });
  if (error) throw new Error(error.message);
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
  targetB: number
): GoalTotalsStatus {
  const { teamA, teamB } = sumGoalsByTeam(entries);
  const teamAOk = teamA === targetA;
  const teamBOk = teamB === targetB;
  return {
    teamA,
    teamB,
    targetA,
    targetB,
    valid: teamAOk && teamBOk,
    teamAOk,
    teamBOk,
    messages: [
      formatGoalDelta('Équipe A', teamA, targetA),
      formatGoalDelta('Équipe B', teamB, targetB),
    ],
  };
}

export function getMvpCandidates(
  entries: MatchStatsState['entries'],
  winningSide: MatchStatsState['winningSide']
): MatchStatsState['entries'] {
  const registered = entries.filter((e) => e.userId && !e.isGuest);
  if (winningSide === 'draw') return registered;
  return registered.filter((e) => e.teamSide === winningSide);
}

export function buildFinalizeStatsFromEntries(
  entries: MatchStatsState['entries'],
  overrides: Record<string, { goals: number; assists: number; defRating: number; fairPlay: number }>
): FinalizePlayerStat[] {
  return entries
    .filter((e) => e.userId && !e.isGuest)
    .map((e) => {
      const key = getParticipantKey(e);
      const override = overrides[key];
      return {
        userId: e.userId!,
        team: e.teamSide,
        goals: override?.goals ?? e.proposedGoals,
        assists: override?.assists ?? e.proposedAssists,
        defRating: override?.defRating ?? e.proposedDefRating,
        fairPlay: override?.fairPlay ?? e.proposedFairPlay,
      };
    });
}
