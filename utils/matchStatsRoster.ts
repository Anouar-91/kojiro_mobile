import { Match } from '@/types';
import { MatchComposition } from '@/types/lineup';
import { RosterEntry } from '@/types/matchStats';
import { User } from '@/types';
import { isGuestPlayerId, parseGuestPlayerId } from '@/utils/guestAttendees';
import { balanceTeams } from '@/utils/teamBalancer';

export function buildRosterFromComposition(composition: MatchComposition): RosterEntry[] {
  return composition.lineups.map((l) => {
    const attendeeId = parseGuestPlayerId(l.userId);
    if (attendeeId) {
      return { attendeeId, team: l.teamSide };
    }
    return { userId: l.userId, team: l.teamSide };
  });
}

export function buildRosterFromPlayers(players: User[]): RosterEntry[] {
  const balanced = balanceTeams(players);
  const roster: RosterEntry[] = [];
  balanced.teamA.forEach((p) => {
    const attendeeId = parseGuestPlayerId(p.user.id);
    if (attendeeId) roster.push({ attendeeId, team: 'A' });
    else roster.push({ userId: p.user.id, team: 'A' });
  });
  balanced.teamB.forEach((p) => {
    const attendeeId = parseGuestPlayerId(p.user.id);
    if (attendeeId) roster.push({ attendeeId, team: 'B' });
    else roster.push({ userId: p.user.id, team: 'B' });
  });
  return roster;
}

export function getPresentRegisteredPlayers(match: Match, getProfile: (id: string) => User | undefined): User[] {
  return match.attendees
    .filter((a) => a.status === 'present' && a.userId)
    .map((a) => getProfile(a.userId!))
    .filter((u): u is User => Boolean(u));
}

export function isRegisteredPresent(match: Match, userId: string | undefined): boolean {
  if (!userId) return false;
  return match.attendees.some((a) => a.userId === userId && a.status === 'present');
}

export function participantDisplayId(userId: string | null, attendeeId: string | null): string {
  if (userId) return userId;
  if (attendeeId) return `guest:${attendeeId}`;
  return '';
}

export function isGuestParticipant(userId: string | null): boolean {
  return !userId;
}
