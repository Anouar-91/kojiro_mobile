import { AttendanceStatus, Match } from '@/types';

type MatchAttendanceRules = Pick<Match, 'attendees' | 'maxPlayers' | 'status' | 'recruitmentClosed'>;

export function countPresentAttendees(
  attendees: { status: AttendanceStatus }[]
): number {
  return attendees.filter((a) => a.status === 'present').length;
}

export function isMatchFull(match: Pick<Match, 'attendees' | 'maxPlayers'>): boolean {
  return countPresentAttendees(match.attendees) >= match.maxPlayers;
}

export function canSetPresent(
  match: Pick<Match, 'attendees' | 'maxPlayers'>,
  userId: string
): boolean {
  const mine = match.attendees.find((a) => a.userId === userId);
  if (mine?.status === 'present') return true;
  return !isMatchFull(match);
}

export function getWaitlistAttendees(
  attendees: Match['attendees']
): Match['attendees'] {
  return [...attendees]
    .filter((a) => a.status === 'waitlist')
    .sort((a, b) => {
      const ta = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      const tb = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
      return ta - tb;
    });
}

export function getWaitlistPosition(
  match: Pick<Match, 'attendees'>,
  userId: string
): number | null {
  const ordered = getWaitlistAttendees(match.attendees);
  const index = ordered.findIndex((a) => a.userId === userId);
  return index >= 0 ? index + 1 : null;
}

export function isOnWaitlist(match: Pick<Match, 'attendees'>, userId: string): boolean {
  return match.attendees.some((a) => a.userId === userId && a.status === 'waitlist');
}

export function isRecruitmentClosed(match: Pick<Match, 'status' | 'recruitmentClosed'>): boolean {
  return match.status === 'upcoming' && match.recruitmentClosed === true;
}

export function isAttendanceFullyLocked(match: Pick<Match, 'status'>): boolean {
  return match.status === 'completed' || match.status === 'cancelled';
}

export function canUseFullAttendanceUI(match: MatchAttendanceRules): boolean {
  return match.status === 'upcoming' && !isRecruitmentClosed(match);
}

export function canWithdrawFromMatch(
  match: MatchAttendanceRules,
  userId: string
): boolean {
  if (match.status === 'completed' || match.status === 'cancelled') return false;
  const mine = match.attendees.find((a) => a.userId === userId);
  if (!mine) return false;
  return mine.status !== 'absent';
}

export function canChangeToPresent(match: MatchAttendanceRules, userId: string): boolean {
  if (isAttendanceFullyLocked(match)) return false;
  if (match.status === 'live') return false;

  const mine = match.attendees.find((a) => a.userId === userId);

  if (isRecruitmentClosed(match)) {
    return mine?.status === 'waitlist' && canSetPresent(match, userId);
  }

  return match.status === 'upcoming';
}

export function canChangeToMaybe(match: MatchAttendanceRules): boolean {
  if (isAttendanceFullyLocked(match) || match.status === 'live') return false;
  return match.status === 'upcoming' && !isRecruitmentClosed(match);
}

export function canChangeToAbsent(match: MatchAttendanceRules, userId: string): boolean {
  return canWithdrawFromMatch(match, userId);
}

export function canJoinWaitlist(
  match: MatchAttendanceRules,
  userId: string
): boolean {
  if (!canUseFullAttendanceUI(match)) return false;
  if (!isMatchFull(match)) return false;
  const mine = match.attendees.find((a) => a.userId === userId);
  if (mine?.status === 'present') return false;
  if (mine?.status === 'waitlist') return false;
  return true;
}

export function canClaimWaitlistSpot(match: MatchAttendanceRules, userId: string): boolean {
  return (
    isRecruitmentClosed(match) &&
    isOnWaitlist(match, userId) &&
    canSetPresent(match, userId)
  );
}

export function isUserRegisteredForMatch(
  match: Pick<Match, 'attendees'>,
  userId: string | undefined
): boolean {
  if (!userId) return false;
  const mine = match.attendees.find((a) => a.userId === userId);
  return Boolean(mine && mine.status !== 'absent');
}

/** @deprecated Prefer canUseFullAttendanceUI / canWithdrawFromMatch */
export function isAttendanceLocked(match: Pick<Match, 'status'>): boolean {
  return match.status === 'live' || match.status === 'completed' || match.status === 'cancelled';
}

/** @deprecated Prefer canUseFullAttendanceUI */
export function canChangeAttendance(match: Pick<Match, 'status' | 'recruitmentClosed'>): boolean {
  return match.status === 'upcoming' && !isRecruitmentClosed(match);
}

export function canInvitePlayers(match: Pick<Match, 'status' | 'recruitmentClosed'>): boolean {
  return match.status === 'upcoming' && !match.recruitmentClosed;
}

export function getAttendanceLockMessage(
  match: Pick<Match, 'status' | 'recruitmentClosed'>
): string {
  if (isRecruitmentClosed(match)) {
    return 'Le recrutement est clos — tu peux encore te désister si tu ne peux plus venir.';
  }
  switch (match.status) {
    case 'live':
      return 'Le match est en cours — tu peux encore te désister si besoin.';
    case 'completed':
      return 'Match terminé — les présences ne peuvent plus être modifiées.';
    case 'cancelled':
      return 'Match annulé — les présences ne peuvent plus être modifiées.';
    default:
      return '';
  }
}

export function canManageRoster(
  match: Pick<Match, 'status'>,
  isOrganizer: boolean
): boolean {
  return isOrganizer && match.status === 'upcoming';
}

export function canAddToRoster(
  match: Pick<Match, 'status' | 'recruitmentClosed'>,
  isOrganizer: boolean
): boolean {
  return isOrganizer && canInvitePlayers(match);
}

export function validateAttendanceChange(
  match: MatchAttendanceRules,
  userId: string,
  status: AttendanceStatus
): void {
  if (status === 'absent') {
    const mine = match.attendees.find((a) => a.userId === userId);
    if (!mine) {
      throw new Error('Tu ne fais pas partie de ce match');
    }
    return;
  }

  if (isAttendanceFullyLocked(match)) {
    throw new Error(getAttendanceLockMessage(match));
  }

  if (match.status === 'live') {
    throw new Error('Tu peux uniquement te désister pendant le match');
  }

  if (isRecruitmentClosed(match)) {
    const mine = match.attendees.find((a) => a.userId === userId);
    if (status === 'present' && mine?.status === 'waitlist') {
      if (!canSetPresent(match, userId)) {
        throw new Error(`Ce match est complet (${match.maxPlayers} places).`);
      }
      return;
    }
    throw new Error('Le recrutement est fermé — tu peux uniquement te désister.');
  }
}
