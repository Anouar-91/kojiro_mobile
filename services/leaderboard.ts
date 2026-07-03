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
  const ids = new Set([...friendIds, currentUserId]);
  const profiles = await fetchAllProfiles();

  return profiles
    .filter((p) => ids.has(p.id))
    .sort((a, b) => b.xp - a.xp)
    .map((profile, index) => ({
      rank: index + 1,
      userId: profile.id,
      score: profile.xp,
    }));
}
