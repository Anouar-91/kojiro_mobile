import { isValid, parseISO } from 'date-fns';

import { Match, MatchStatus } from '@/types';

/** Normalise une date DB (`YYYY-MM-DD` ou ISO) vers `YYYY-MM-DD`. */
export function normalizeMatchDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const trimmed = String(date).trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

/** Normalise une heure DB vers `HH:mm`. */
export function normalizeMatchTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const trimmed = String(time).trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function getMatchStartMs(match: Pick<Match, 'date' | 'time'>): number | null {
  try {
    const date = normalizeMatchDate(match.date);
    const time = normalizeMatchTime(match.time);
    if (!date || !time) return null;
    const parsed = parseISO(`${date}T${time}`);
    if (!isValid(parsed)) return null;
    return parsed.getTime();
  } catch {
    return null;
  }
}

export function isMatchPast(match: Pick<Match, 'date' | 'time'>, now = Date.now()): boolean {
  const start = getMatchStartMs(match);
  if (start != null) return start < now;

  // Fallback si heure invalide : une date strictement avant aujourd'hui est passée.
  const date = normalizeMatchDate(match.date);
  if (!date) return true;
  const today = new Date(now);
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return date < `${yyyy}-${mm}-${dd}`;
}

/** Match affiché dans les listes « à venir » : date/heure future uniquement. */
export function isMatchListedAsUpcoming(match: Match, now = Date.now()): boolean {
  if (isMatchPast(match, now)) return false;
  return match.status === 'upcoming' || match.status === 'live';
}

/** Match encore ouvert (upcoming/live), y compris après l'heure de début. */
export function isMatchUnfinishedOpen(match: Pick<Match, 'status'>): boolean {
  return match.status === 'upcoming' || match.status === 'live';
}

/**
 * Match qui doit encore être finalisé côté stats :
 * - déjà en `pending_stats`, ou
 * - encore `upcoming`/`live` alors que le coup d'envoi est passé
 *   (l'orga n'a pas encore ouvert la saisie).
 */
export function isMatchAwaitingStats(match: Match, now = Date.now()): boolean {
  if (isMatchPendingStats(match)) return true;
  return isMatchUnfinishedOpen(match) && isMatchPast(match, now);
}

/** Match en attente de saisie / finalisation des stats (hors liste principale). */
export function isMatchPendingStats(match: Pick<Match, 'status'>): boolean {
  return match.status === 'pending_stats';
}

export function isActiveMatchStatus(status: MatchStatus): boolean {
  return status === 'upcoming' || status === 'live' || status === 'pending_stats';
}
