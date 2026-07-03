import { Position, User } from '@/types';

interface BalancedPlayer {
  user: User;
  skillScore: number;
}

const POSITION_WEIGHT: Record<Position, number> = {
  GK: 1.2,
  DEF: 1.0,
  MID: 1.1,
  FWD: 1.05,
};

function computeSkillScore(user: User): number {
  const baseScore = user.level * 6 + user.rating * 8;
  const positionBonus = POSITION_WEIGHT[user.position] * 5;
  const statsBonus =
    user.stats.averageRating * 2 +
    Math.min(user.stats.goals / Math.max(user.stats.matchesPlayed, 1), 1) * 10;
  return Math.round(baseScore + positionBonus + statsBonus);
}

function hasGoalkeeper(players: BalancedPlayer[]): boolean {
  return players.some((p) => p.user.position === 'GK');
}

export interface BalancedTeams {
  teamA: BalancedPlayer[];
  teamB: BalancedPlayer[];
  averageA: number;
  averageB: number;
}

export function balanceTeams(players: User[]): BalancedTeams {
  const scored: BalancedPlayer[] = players
    .map((user) => ({ user, skillScore: computeSkillScore(user) }))
    .sort((a, b) => b.skillScore - a.skillScore);

  const teamA: BalancedPlayer[] = [];
  const teamB: BalancedPlayer[] = [];

  scored.forEach((player, index) => {
    const sumA = teamA.reduce((s, p) => s + p.skillScore, 0);
    const sumB = teamB.reduce((s, p) => s + p.skillScore, 0);

    if (index % 2 === 0) {
      if (sumA <= sumB) teamA.push(player);
      else teamB.push(player);
    } else {
      if (sumB <= sumA) teamB.push(player);
      else teamA.push(player);
    }
  });

  const gkA = teamA.filter((p) => p.user.position === 'GK');
  const gkB = teamB.filter((p) => p.user.position === 'GK');

  if (gkA.length > 1) {
    const extra = gkA.pop()!;
    teamB.push(extra);
  }
  if (gkB.length > 1) {
    const extra = gkB.pop()!;
    teamA.push(extra);
  }

  if (!hasGoalkeeper(teamA) && hasGoalkeeper(teamB)) {
    const gk = teamB.find((p) => p.user.position === 'GK');
    if (gk) {
      teamB.splice(teamB.indexOf(gk), 1);
      teamA.push(gk);
    }
  } else if (!hasGoalkeeper(teamB) && hasGoalkeeper(teamA)) {
    const gk = teamA.find((p) => p.user.position === 'GK');
    if (gk) {
      teamA.splice(teamA.indexOf(gk), 1);
      teamB.push(gk);
    }
  }

  const averageA =
    teamA.length > 0
      ? Math.round(teamA.reduce((s, p) => s + p.skillScore, 0) / teamA.length)
      : 0;
  const averageB =
    teamB.length > 0
      ? Math.round(teamB.reduce((s, p) => s + p.skillScore, 0) / teamB.length)
      : 0;

  return { teamA, teamB, averageA, averageB };
}

export function getSkillScore(user: User): number {
  return computeSkillScore(user);
}
