import { mapProfileToUser } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { FriendRequest, User } from '@/types';
import { distanceKm, getUserPosition, WIDER_MATCH_RADIUS_KM } from '@/utils/geo';

export type FriendSuggestionReason = 'mutual_friend' | 'same_city' | 'nearby';

export interface FriendSuggestion {
  user: User;
  reason: FriendSuggestionReason;
  label: string;
}

const REASON_PRIORITY: Record<FriendSuggestionReason, number> = {
  mutual_friend: 3,
  same_city: 1,
  nearby: 2,
};

function buildExcludedIds(
  userId: string,
  friendIds: string[],
  requests: FriendRequest[]
): Set<string> {
  const excluded = new Set<string>([userId, ...friendIds]);
  for (const request of requests) {
    if (request.status !== 'pending' && request.status !== 'accepted') continue;
    if (request.fromUserId === userId) excluded.add(request.toUserId);
    if (request.toUserId === userId) excluded.add(request.fromUserId);
  }
  return excluded;
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase().split(',')[0]?.trim() ?? '';
}

async function fetchFriendsOfFriends(
  friendIds: string[],
  excluded: Set<string>
): Promise<Map<string, string>> {
  const viaFriend = new Map<string, string>();
  if (friendIds.length === 0) return viaFriend;

  const [{ data: fromRows }, { data: toRows }] = await Promise.all([
    supabase
      .from('friend_requests')
      .select('from_user_id, to_user_id')
      .eq('status', 'accepted')
      .in('from_user_id', friendIds),
    supabase
      .from('friend_requests')
      .select('from_user_id, to_user_id')
      .eq('status', 'accepted')
      .in('to_user_id', friendIds),
  ]);

  for (const row of [...(fromRows ?? []), ...(toRows ?? [])]) {
    const friendId = friendIds.includes(row.from_user_id) ? row.from_user_id : row.to_user_id;
    const candidateId =
      row.from_user_id === friendId ? row.to_user_id : row.from_user_id;
    if (excluded.has(candidateId) || viaFriend.has(candidateId)) continue;
    viaFriend.set(candidateId, friendId);
  }

  return viaFriend;
}

async function fetchProfilesByCity(
  city: string,
  excluded: Set<string>,
  limit: number
): Promise<User[]> {
  const pattern = `%${city.replace(/[%_]/g, '')}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('city', pattern)
    .limit(limit);

  if (error || !data) return [];
  return data
    .map(mapProfileToUser)
    .filter((profile) => !excluded.has(profile.id));
}

async function fetchProfilesWithCoords(excluded: Set<string>, limit: number): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(limit);

  if (error || !data) return [];
  return data
    .map(mapProfileToUser)
    .filter((profile) => !excluded.has(profile.id));
}

function formatDistanceKm(km: number): string {
  if (km < 1) return 'À moins de 1 km';
  return `À ${Math.round(km)} km`;
}

export async function fetchFriendSuggestions(
  user: User,
  friendIds: string[],
  requests: FriendRequest[],
  friendNames: Record<string, string>,
  limit = 15
): Promise<FriendSuggestion[]> {
  const excluded = buildExcludedIds(user.id, friendIds, requests);
  const userCity = normalizeCity(user.city);
  const userPosition = getUserPosition(user);

  const [fofMap, cityProfiles, geoProfiles] = await Promise.all([
    fetchFriendsOfFriends(friendIds, excluded),
    userCity ? fetchProfilesByCity(user.city, excluded, 30) : Promise.resolve([]),
    fetchProfilesWithCoords(excluded, 150),
  ]);

  const candidateIds = new Set<string>();
  const suggestions = new Map<string, FriendSuggestion>();

  const upsert = (
    profile: User,
    reason: FriendSuggestionReason,
    label: string
  ) => {
    if (excluded.has(profile.id)) return;
    const existing = suggestions.get(profile.id);
    if (existing && REASON_PRIORITY[existing.reason] >= REASON_PRIORITY[reason]) return;
    suggestions.set(profile.id, { user: profile, reason, label });
    candidateIds.add(profile.id);
  };

  if (fofMap.size > 0) {
    const missingIds = [...fofMap.keys()].filter((id) => !candidateIds.has(id));
    const { data: fofProfiles } = missingIds.length
      ? await supabase.from('profiles').select('*').in('id', missingIds)
      : { data: [] };

    for (const row of fofProfiles ?? []) {
      const profile = mapProfileToUser(row);
      const viaFriendId = fofMap.get(profile.id);
      const viaName = viaFriendId ? friendNames[viaFriendId] : undefined;
      const firstName = viaName?.split(' ')[0] ?? 'un ami';
      upsert(profile, 'mutual_friend', `Ami de ${firstName}`);
    }
  }

  for (const profile of cityProfiles) {
    if (normalizeCity(profile.city) === userCity) {
      upsert(profile, 'same_city', `Habite à ${profile.city}`);
    }
  }

  for (const profile of geoProfiles) {
    if (profile.latitude == null || profile.longitude == null) continue;
    const km = distanceKm(userPosition, {
      latitude: profile.latitude,
      longitude: profile.longitude,
    });
    if (km > WIDER_MATCH_RADIUS_KM) continue;
    upsert(profile, 'nearby', formatDistanceKm(km));
  }

  return [...suggestions.values()]
    .sort((a, b) => {
      const priorityDiff = REASON_PRIORITY[b.reason] - REASON_PRIORITY[a.reason];
      if (priorityDiff !== 0) return priorityDiff;
      return a.user.name.localeCompare(b.user.name, 'fr');
    })
    .slice(0, limit);
}
