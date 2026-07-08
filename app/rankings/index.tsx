import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LeaderboardPodium, PlayerListItem } from '@/components/community/CommunityComponents';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchFriendsLeaderboard } from '@/services/leaderboard';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useProfileStore } from '@/store/profileStore';
import { LeaderboardEntry, User } from '@/types';

export default function RankingsScreen() {
  const user = useAuthStore((s) => s.user);
  const profiles = useProfileStore((s) => s.profiles);
  const friendIds = useFriendStore((s) => s.friendIds);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const getProfile = useProfileStore((s) => s.getProfile);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const usersMap = Object.fromEntries(profiles.map((u) => [u.id, u])) as Record<string, User>;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setLeaderboard(await fetchFriendsLeaderboard(friendIds, user.id));
    } finally {
      setLoading(false);
    }
  }, [user, friendIds]);

  useEffect(() => {
    if (user) fetchFriends(user.id);
  }, [user, fetchFriends]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Compare ton XP avec tes amis</Text>

      {friendIds.length === 0 && (
        <Text style={styles.hint}>Ajoute des amis pour voir le classement complet.</Text>
      )}

      <LeaderboardPodium entries={leaderboard.slice(0, 3)} users={usersMap} />

      {leaderboard.map((entry) => {
        const profile = getProfile(entry.userId);
        if (!profile) return null;
        return <PlayerListItem key={entry.userId} user={profile} rank={entry.rank} score={entry.score} />;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  subtitle: { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.md },
  hint: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.lg },
});
