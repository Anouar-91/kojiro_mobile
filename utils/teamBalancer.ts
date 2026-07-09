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

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

function computeSkillScore(user: User): number {
  const baseScore = user.level * 6 + user.rating * 8;
  const positionBonus = POSITION_WEIGHT[user.position] * 5;
  const statsBonus =
    user.stats.averageRating * 2 +
    Math.min(user.stats.goals / Math.max(user.stats.matchesPlayed, 1), 1) * 10;
  return Math.round(baseScore + positionBonus + statsBonus);
}

function countByPosition(players: BalancedPlayer[], position: Position): number {
  return players.filter((p) => p.user.position === position).length;
}

function pickTeamForPlayer(
  player: BalancedPlayer,
  teamA: BalancedPlayer[],
  teamB: BalancedPlayer[]
): 'A' | 'B' {
  const pos = player.user.position;
  const countA = countByPosition(teamA, pos);
  const countB = countByPosition(teamB, pos);
  if (countA !== countB) return countA < countB ? 'A' : 'B';

  const sumA = teamA.reduce((s, p) => s + p.skillScore, 0);
  const sumB = teamB.reduce((s, p) => s + p.skillScore, 0);
  if (sumA !== sumB) return sumA <= sumB ? 'A' : 'B';

  return teamA.length <= teamB.length ? 'A' : 'B';
}

function rebalanceGoalkeepers(teamA: BalancedPlayer[], teamB: BalancedPlayer[]): void {
  const gkA = teamA.filter((p) => p.user.position === 'GK');
  const gkB = teamB.filter((p) => p.user.position === 'GK');

  if (gkA.length > 1) {
    const extra = gkA.pop()!;
    teamA.splice(teamA.indexOf(extra), 1);
    teamB.push(extra);
  }
  if (gkB.length > 1) {
    const extra = gkB.pop()!;
    teamB.splice(teamB.indexOf(extra), 1);
    teamA.push(extra);
  }

  const hasGkA = teamA.some((p) => p.user.position === 'GK');
  const hasGkB = teamB.some((p) => p.user.position === 'GK');

  if (!hasGkA && hasGkB) {
    const gk = teamB.find((p) => p.user.position === 'GK');
    if (gk) {
      teamB.splice(teamB.indexOf(gk), 1);
      teamA.push(gk);
    }
  } else if (!hasGkB && hasGkA) {
    const gk = teamA.find((p) => p.user.position === 'GK');
    if (gk) {
      teamA.splice(teamA.indexOf(gk), 1);
      teamB.push(gk);
    }
  }
}

export interface BalancedTeams {
  teamA: BalancedPlayer[];
  teamB: BalancedPlayer[];
  averageA: number;
  averageB: number;
}

export function balanceTeams(players: User[]): BalancedTeams {
  const scored: BalancedPlayer[] = players.map((user) => ({
    user,
    skillScore: computeSkillScore(user),
  }));

  const byPosition: Record<Position, BalancedPlayer[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  scored.forEach((player) => {
    byPosition[player.user.position].push(player);
  });

  (Object.keys(byPosition) as Position[]).forEach((pos) => {
    byPosition[pos].sort((a, b) => b.skillScore - a.skillScore);
  });

  const teamA: BalancedPlayer[] = [];
  const teamB: BalancedPlayer[] = [];

  for (const position of POSITION_ORDER) {
    for (const player of byPosition[position]) {
      const target = pickTeamForPlayer(player, teamA, teamB);
      if (target === 'A') teamA.push(player);
      else teamB.push(player);
    }
    if (position === 'GK') rebalanceGoalkeepers(teamA, teamB);
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
