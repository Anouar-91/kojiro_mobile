import { TeamSide } from '@/types/lineup';

/** Note défensive par défaut (neutre) si non saisie */
export const DEFAULT_DEFENSIVE_RATING = 3;

/** Note fair-play par défaut si non saisie */
export const DEFAULT_FAIR_PLAY_RATING = 4;

export interface MatchStatEntry {
  entryId: string;
  userId: string | null;
  attendeeId: string | null;
  teamSide: TeamSide;
  selfGoals: number | null;
  selfAssists: number | null;
  selfDefRating: number | null;
  selfFairPlay: number | null;
  selfSubmittedAt: string | null;
  captainGoals: number | null;
  captainAssists: number | null;
  captainDefRating: number | null;
  captainFairPlay: number | null;
  captainUpdatedAt: string | null;
  proposedGoals: number;
  proposedAssists: number;
  proposedDefRating: number;
  proposedFairPlay: number;
  name: string;
  isGuest: boolean;
}

export interface MatchTeamValidation {
  teamSide: TeamSide;
  validatedBy: string;
  validatedAt: string;
}

export interface MatchMvpVote {
  voterId: string;
  votedForId: string | null;
  votedForAttendeeId: string | null;
}

export interface MatchMvpTally {
  userId: string | null;
  attendeeId: string | null;
  votes: number;
}

export interface MatchStatsState {
  matchId: string;
  status: string;
  teamAScore: number | null;
  teamBScore: number | null;
  winningSide: 'A' | 'B' | 'draw';
  statsOpenedAt: string | null;
  organizerId: string;
  captainAId: string | null;
  captainBId: string | null;
  entries: MatchStatEntry[];
  teamValidations: MatchTeamValidation[];
  mvpVotes: MatchMvpVote[];
  mvpTally: MatchMvpTally[];
  myCaptainSide: TeamSide | null;
}

export interface RosterEntry {
  userId?: string;
  attendeeId?: string;
  team: TeamSide;
}

export interface CaptainPlayerStatInput {
  userId?: string;
  attendeeId?: string;
  goals: number;
  assists: number;
  defRating: number;
  fairPlay: number;
}

export interface FinalizePlayerStat {
  userId?: string;
  attendeeId?: string;
  team: TeamSide;
  goals: number;
  assists: number;
  defRating: number;
  fairPlay: number;
}

export interface EditableMatchStat {
  goals: number;
  assists: number;
  defRating: number;
  fairPlay: number;
}

export function defaultEditableMatchStat(): EditableMatchStat {
  return {
    goals: 0,
    assists: 0,
    defRating: DEFAULT_DEFENSIVE_RATING,
    fairPlay: DEFAULT_FAIR_PLAY_RATING,
  };
}
