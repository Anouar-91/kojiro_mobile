import { isValid, parseISO } from 'date-fns';

import { Match, MatchStatus } from '@/types';

export function getMatchStartMs(match: Pick<Match, 'date' | 'time'>): number | null {
  try {
    const date = parseISO(`${match.date}T${match.time}`);
    if (!isValid(date)) return null;
    return date.getTime();
  } catch {
    return null;
  }
}

export function isMatchPast(match: Pick<Match, 'date' | 'time'>, now = Date.now()): boolean {
  const start = getMatchStartMs(match);
  if (start == null) return true;
  return start < now;
}

/** Match affiché dans les listes « à venir » : date/heure future uniquement. */
export function isMatchListedAsUpcoming(match: Match, now = Date.now()): boolean {
  if (isMatchPast(match, now)) return false;
  return match.status === 'upcoming' || match.status === 'live';
}

/** Match en attente de saisie / finalisation des stats (hors liste principale). */
export function isMatchPendingStats(match: Pick<Match, 'status'>): boolean {
  return match.status === 'pending_stats';
}

export function isActiveMatchStatus(status: MatchStatus): boolean {
  return status === 'upcoming' || status === 'live' || status === 'pending_stats';
}
