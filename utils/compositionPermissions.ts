import { MatchComposition } from '@/types/lineup';

export type CompositionRole = 'organizer' | 'captain_a' | 'captain_b' | 'viewer';

export function getRegisteredPresentUserIds(
  attendees: { userId?: string | null; status: string }[]
): Set<string> {
  return new Set(
    attendees
      .filter((a) => a.status === 'present' && a.userId)
      .map((a) => a.userId!)
  );
}

function isActiveCaptain(
  userId: string,
  captainId: string | null | undefined,
  registeredPresentIds?: Set<string>
): boolean {
  if (!captainId || captainId !== userId) return false;
  if (!registeredPresentIds) return true;
  return registeredPresentIds.has(userId);
}

export function getCompositionRole(
  userId: string | undefined,
  organizerId: string,
  composition: MatchComposition | null,
  registeredPresentIds?: Set<string>
): CompositionRole {
  if (!userId) return 'viewer';
  if (userId === organizerId) return 'organizer';
  if (isActiveCaptain(userId, composition?.captainAId, registeredPresentIds)) return 'captain_a';
  if (isActiveCaptain(userId, composition?.captainBId, registeredPresentIds)) return 'captain_b';
  return 'viewer';
}

export function canEditComposition(
  role: CompositionRole,
  matchStatus: string,
  _composition: MatchComposition | null
): boolean {
  if (
    matchStatus === 'completed' ||
    matchStatus === 'cancelled' ||
    matchStatus === 'live' ||
    matchStatus === 'pending_stats'
  ) {
    return false;
  }
  if (role === 'organizer') return true;
  if (role === 'captain_a' || role === 'captain_b') return true;
  return false;
}

export function canPublishComposition(role: CompositionRole, matchStatus: string): boolean {
  return (
    role === 'organizer' &&
    matchStatus !== 'completed' &&
    matchStatus !== 'cancelled' &&
    matchStatus !== 'live' &&
    matchStatus !== 'pending_stats'
  );
}

export function canAssignCaptains(role: CompositionRole, matchStatus: string): boolean {
  return (
    role === 'organizer' &&
    matchStatus !== 'completed' &&
    matchStatus !== 'cancelled' &&
    matchStatus !== 'pending_stats'
  );
}

export function isCaptainRole(role: CompositionRole): boolean {
  return role === 'captain_a' || role === 'captain_b';
}

export function hasCompositionLineups(composition: MatchComposition | null): boolean {
  return Boolean(composition?.lineups.length);
}

export function getComposeButtonLabel(role: CompositionRole, canEdit: boolean): string {
  if (!canEdit) return 'Voir la composition';

  switch (role) {
    case 'organizer':
      return 'Composer les équipes';
    case 'captain_a':
      return 'Composer équipe A';
    case 'captain_b':
      return 'Composer équipe B';
    default:
      return 'Voir la composition';
  }
}

export function getCompositionLockMessage(role: CompositionRole, matchStatus: string): string {
  if (matchStatus === 'live') {
    return 'Le match est en cours — la composition est en lecture seule.';
  }
  if (matchStatus === 'pending_stats') {
    return 'Saisie des stats en cours — la composition est en lecture seule.';
  }
  if (matchStatus === 'completed') {
    return 'Match terminé.';
  }
  if (role === 'viewer') {
    return 'Seul l\'organisateur ou les capitaines peuvent composer les équipes.';
  }
  return 'La composition est en lecture seule.';
}
