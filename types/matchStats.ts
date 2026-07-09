import { TeamSide } from '@/types/lineup';

export interface MatchStatEntry {
  entryId: string;
  userId: string | null;
  attendeeId: string | null;
  teamSide: TeamSide;
  selfGoals: number | null;
  selfAssists: number | null;
  selfSubmittedAt: string | null;
  captainGoals: number | null;
  captainAssists: number | null;
  captainUpdatedAt: string | null;
  proposedGoals: number;
  proposedAssists: number;
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
  votedForId: string;
}

export interface MatchMvpTally {
  userId: string;
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
}

export interface FinalizePlayerStat {
  userId: string;
  team: TeamSide;
  goals: number;
  assists: number;
}
