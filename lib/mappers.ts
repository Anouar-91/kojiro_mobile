import { DbMatch, DbProfile } from '@/lib/supabase';
import { Badge, Foot, Match, MatchAttendee, MatchFormat, Position, User } from '@/types';

const DEFAULT_STATS = {
  matchesPlayed: 0,
  goals: 0,
  assists: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  mvpCount: 0,
  averageRating: 4.0,
  fairPlayScore: 90,
  shotsOnTarget: 0,
  passAccuracy: 0,
  minutesPlayed: 0,
};

export function mapProfileToUser(profile: DbProfile): User {
  const stats = profile.stats ?? {};
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatar: profile.avatar_url ?? `https://i.pravatar.cc/150?u=${profile.id}`,
    position: profile.position as Position,
    foot: profile.foot as Foot,
    level: profile.level,
    xp: profile.xp,
    xpToNextLevel: profile.xp_to_next_level,
    rating: Number(profile.rating),
    city: profile.city,
    latitude: profile.latitude ?? undefined,
    longitude: profile.longitude ?? undefined,
    bio: profile.bio ?? undefined,
    badges: (profile.badges ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      description: b.description,
      earnedAt: b.earned_at,
    })),
    stats: {
      matchesPlayed: stats.matchesPlayed ?? DEFAULT_STATS.matchesPlayed,
      goals: stats.goals ?? DEFAULT_STATS.goals,
      assists: stats.assists ?? DEFAULT_STATS.assists,
      wins: stats.wins ?? DEFAULT_STATS.wins,
      losses: stats.losses ?? DEFAULT_STATS.losses,
      draws: stats.draws ?? DEFAULT_STATS.draws,
      mvpCount: stats.mvpCount ?? DEFAULT_STATS.mvpCount,
      averageRating: stats.averageRating ?? DEFAULT_STATS.averageRating,
      fairPlayScore: stats.fairPlayScore ?? DEFAULT_STATS.fairPlayScore,
      shotsOnTarget: stats.shotsOnTarget ?? DEFAULT_STATS.shotsOnTarget,
      passAccuracy: stats.passAccuracy ?? DEFAULT_STATS.passAccuracy,
      minutesPlayed: stats.minutesPlayed ?? DEFAULT_STATS.minutesPlayed,
    },
    createdAt: profile.created_at,
  };
}

export function mapDbMatchToMatch(row: DbMatch): Match {
  const attendees: MatchAttendee[] = (row.match_attendees ?? []).map((a) => ({
    userId: a.user_id,
    status: a.status as MatchAttendee['status'],
    teamId: a.team_id ?? undefined,
  }));

  return {
    id: row.id,
    title: row.title,
    format: row.format as MatchFormat,
    substitutesPerTeam: row.substitutes_per_team ?? 0,
    visibility: (row.visibility ?? 'public') as Match['visibility'],
    date: row.date,
    time: row.time.slice(0, 5),
    location: {
      name: row.location_name,
      address: row.location_address,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    pricePerPlayer: Number(row.price_per_player),
    description: row.description ?? undefined,
    organizerId: row.organizer_id,
    maxPlayers: row.max_players,
    status: row.status as Match['status'],
    attendees,
    chatId: row.id,
    imageUrl: row.image_url ?? undefined,
    tournamentId: row.tournament_id ?? undefined,
  };
}

export function userToProfileUpdate(updates: Partial<User>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.avatar !== undefined) mapped.avatar_url = updates.avatar;
  if (updates.position !== undefined) mapped.position = updates.position;
  if (updates.foot !== undefined) mapped.foot = updates.foot;
  if (updates.city !== undefined) mapped.city = updates.city;
  if (updates.latitude !== undefined) mapped.latitude = updates.latitude;
  if (updates.longitude !== undefined) mapped.longitude = updates.longitude;
  if (updates.bio !== undefined) mapped.bio = updates.bio;
  if (updates.level !== undefined) mapped.level = updates.level;
  if (updates.xp !== undefined) mapped.xp = updates.xp;
  if (updates.xpToNextLevel !== undefined) mapped.xp_to_next_level = updates.xpToNextLevel;
  if (updates.rating !== undefined) mapped.rating = updates.rating;
  if (updates.stats !== undefined) mapped.stats = updates.stats;
  if (updates.badges !== undefined) {
    mapped.badges = updates.badges.map((b: Badge) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      description: b.description,
      earned_at: b.earnedAt,
    }));
  }
  return mapped;
}
