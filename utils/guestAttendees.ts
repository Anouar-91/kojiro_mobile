import { Match, MatchAttendee, User } from '@/types';

export const GUEST_PLAYER_ID_PREFIX = 'guest:';

export function guestPlayerId(attendeeId: string): string {
  return `${GUEST_PLAYER_ID_PREFIX}${attendeeId}`;
}

export function isGuestPlayerId(id: string): boolean {
  return id.startsWith(GUEST_PLAYER_ID_PREFIX);
}

export function parseGuestPlayerId(id: string): string | null {
  if (!isGuestPlayerId(id)) return null;
  return id.slice(GUEST_PLAYER_ID_PREFIX.length);
}

export function getAttendeeParticipantId(attendee: MatchAttendee): string {
  if (attendee.userId) return attendee.userId;
  if (attendee.id) return guestPlayerId(attendee.id);
  throw new Error('Participant invalide');
}

export function buildGuestUser(attendee: MatchAttendee): User | null {
  if (!attendee.guestName || !attendee.id) return null;

  return {
    id: guestPlayerId(attendee.id),
    email: '',
    name: attendee.guestName,
    avatar: '',
    position: 'MID',
    foot: 'Droit',
    level: 5,
    xp: 0,
    xpToNextLevel: 1000,
    rating: 4,
    city: '',
    badges: [],
    stats: {
      matchesPlayed: 0,
      goals: 0,
      assists: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      mvpCount: 0,
      averageRating: 4,
      averageFairPlay: 4,
      fairPlayScore: 80,
      shotsOnTarget: 0,
      passAccuracy: 0,
      minutesPlayed: 0,
    },
    createdAt: attendee.joinedAt ?? new Date().toISOString(),
    isGuest: true,
  };
}

export function attendeeToDisplayUser(
  attendee: MatchAttendee,
  getProfile: (id: string) => User | undefined
): User | null {
  if (attendee.userId) return getProfile(attendee.userId) ?? null;
  return buildGuestUser(attendee);
}

export function resolveParticipantUser(
  participantId: string,
  match: Match,
  getProfile: (id: string) => User | undefined
): User | null {
  const attendeeId = parseGuestPlayerId(participantId);
  if (attendeeId) {
    const attendee = match.attendees.find((a) => a.id === attendeeId);
    return attendee ? buildGuestUser(attendee) : null;
  }
  return getProfile(participantId) ?? null;
}
