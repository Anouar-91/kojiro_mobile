import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatMatchDate(dateStr: string, timeStr: string): string {
  try {
    const date = parseISO(`${dateStr}T${timeStr}`);
    return format(date, "EEEE d MMMM 'à' HH:mm", { locale: fr });
  } catch {
    return `${dateStr} à ${timeStr}`;
  }
}

export function formatShortDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'd MMM', { locale: fr });
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: fr });
  } catch {
    return dateStr;
  }
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatPrice(amount: number): string {
  if (amount === 0) return 'Gratuit';
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function getPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    GK: 'Gardien',
    DEF: 'Défenseur',
    MID: 'Milieu',
    FWD: 'Attaquant',
  };
  return labels[position] ?? position;
}

export function getFormatLabel(playersPerTeam: number): string {
  return `${playersPerTeam}v${playersPerTeam}`;
}

export function getMaxPlayers(playersPerTeam: number, substitutesPerTeam = 0): number {
  return (playersPerTeam + substitutesPerTeam) * 2;
}

export function getMatchFormatDescription(playersPerTeam: number, substitutesPerTeam = 0): string {
  const base = getFormatLabel(playersPerTeam);
  if (substitutesPerTeam <= 0) return base;
  return `${base} (+${substitutesPerTeam} remp.)`;
}

export function clampSubstitutesPerTeam(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value)));
}

export function clampPlayersPerTeam(value: number): number {
  return Math.min(15, Math.max(2, Math.round(value)));
}
