export type MatchResultLabel = 'Victoire' | 'Défaite' | 'Nul';

export interface MatchRatingInput {
  result: MatchResultLabel;
  goals: number;
  assists: number;
  mvp: boolean;
  defRating: number;
  fairPlay: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Note globale /5 calculée à la finalisation — doit rester alignée avec compute_match_global_rating (SQL). */
export function computeMatchGlobalRating(input: MatchRatingInput): number {
  const goals = Math.max(input.goals, 0);
  const assists = Math.max(input.assists, 0);
  const defRating = clamp(input.defRating, 1, 5);
  const fairPlay = clamp(input.fairPlay, 1, 5);

  const resultBonus =
    input.result === 'Victoire' ? 0.2 : input.result === 'Défaite' ? -0.15 : 0;

  const raw =
    3.0 +
    resultBonus +
    Math.min(goals * 0.25, 0.75) +
    Math.min(assists * 0.15, 0.45) +
    (input.mvp ? 0.35 : 0) +
    (defRating - 3) * 0.2 +
    (fairPlay - 4) * 0.15;

  return Math.round(clamp(raw, 1, 5) * 10) / 10;
}

export function getResultForTeam(
  team: 'A' | 'B',
  teamAScore: number,
  teamBScore: number
): MatchResultLabel {
  if (teamAScore === teamBScore) return 'Nul';
  if (team === 'A') {
    return teamAScore > teamBScore ? 'Victoire' : 'Défaite';
  }
  return teamBScore > teamAScore ? 'Victoire' : 'Défaite';
}
