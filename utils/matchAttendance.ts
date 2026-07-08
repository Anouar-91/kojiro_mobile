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
