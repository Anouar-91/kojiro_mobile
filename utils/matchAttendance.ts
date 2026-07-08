import { AttendanceStatus, Match } from '@/types';

export function countPresentAttendees(
  attendees: { userId: string; status: AttendanceStatus }[]
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

export function canJoinWaitlist(
  match: Pick<Match, 'attendees' | 'maxPlayers'>,
  userId: string
): boolean {
  if (!isMatchFull(match)) return false;
  const mine = match.attendees.find((a) => a.userId === userId);
  if (mine?.status === 'present') return false;
  if (mine?.status === 'waitlist') return false;
  return true;
}

export function isUserRegisteredForMatch(
  match: Pick<Match, 'attendees'>,
  userId: string | undefined
): boolean {
  if (!userId) return false;
  const mine = match.attendees.find((a) => a.userId === userId);
  return Boolean(mine && mine.status !== 'absent');
}
