import { mapProfileToUser } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { fetchAllProfiles } from '@/services/profiles';
import { LeaderboardEntry } from '@/types';

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const profiles = await fetchAllProfiles();

  return profiles
    .sort((a, b) => b.xp - a.xp || b.level - a.level)
    .slice(0, limit)
    .map((profile, index) => ({
      rank: index + 1,
      userId: profile.id,
      score: profile.xp,
    }));
}

export async function fetchFriendsLeaderboard(
  friendIds: string[],
  currentUserId: string
): Promise<LeaderboardEntry[]> {
  const ids = [...new Set([...friendIds, currentUserId])];
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
  if (error || !data) return [];

  return data
    .map(mapProfileToUser)
    .sort((a, b) => b.xp - a.xp || b.level - a.level)
    .map((profile, index) => ({
      rank: index + 1,
      userId: profile.id,
      score: profile.xp,
    }));
}
