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

export function getFormatLabel(format: number): string {
  return `Foot à ${format}`;
}
