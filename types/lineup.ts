export type TeamSide = 'A' | 'B';

export interface FormationSlot {
  id: string;
  label: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  x: number;
  y: number;
}

export interface LineupPlacement {
  userId: string;
  teamSide: TeamSide;
  slotId: string | null;
  posX?: number;
  posY?: number;
}

export interface MatchComposition {
  matchId: string;
  formationA: string;
  formationB: string;
  validatedAt?: string;
  lineups: LineupPlacement[];
}
