import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { LeaderboardPodium, PlayerListItem } from '@/components/community/CommunityComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { Colors, Spacing } from '@/constants/theme';
import { getUserById, mockLeaderboard } from '@/data/mock';

type RankingTab = 'general' | 'monthly' | 'friends' | 'cities';

export default function RankingsScreen() {
  const [tab, setTab] = useState<RankingTab>('general');
  const usersMap = Object.fromEntries(
    mockLeaderboard.map((e) => [e.userId, getUserById(e.userId)]).filter(([, u]) => u)
  );

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

      <LeaderboardPodium entries={mockLeaderboard} users={usersMap as Record<string, NonNullable<ReturnType<typeof getUserById>>>} />

      {mockLeaderboard.map((entry) => {
        const user = getUserById(entry.userId);
        if (!user) return null;
        return <PlayerListItem key={entry.userId} user={user} rank={entry.rank} score={entry.score} />;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
});
