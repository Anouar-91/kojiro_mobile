import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { LeaderboardPodium, PlayerListItem } from '@/components/community/CommunityComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { Colors, Spacing } from '@/constants/theme';
import { fetchFriendsLeaderboard, fetchLeaderboard } from '@/services/leaderboard';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useProfileStore } from '@/store/profileStore';
import { LeaderboardEntry, User } from '@/types';

type RankingTab = 'general' | 'monthly' | 'friends' | 'cities';

export default function RankingsScreen() {
  const user = useAuthStore((s) => s.user);
  const profiles = useProfileStore((s) => s.profiles);
  const friendIds = useFriendStore((s) => s.friendIds);
  const getProfile = useProfileStore((s) => s.getProfile);
  const [tab, setTab] = useState<RankingTab>('general');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const usersMap = Object.fromEntries(profiles.map((u) => [u.id, u])) as Record<string, User>;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'friends' && user) {
        setLeaderboard(await fetchFriendsLeaderboard(friendIds, user.id));
      } else {
        setLeaderboard(await fetchLeaderboard());
      }
    } finally {
      setLoading(false);
    }
  }, [tab, user, friendIds]);

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
      <ChipGroup
        options={[
          { label: 'Général', value: 'general' },
          { label: 'Mensuel', value: 'monthly' },
          { label: 'Amis', value: 'friends' },
          { label: 'Villes', value: 'cities' },
        ]}
        selected={tab}
        onSelect={(v) => setTab(v as RankingTab)}
      />

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
});
