import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HighlightCard, LeaderboardPodium, PlayerListItem } from '@/components/community/CommunityComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getUserById, mockLeaderboard, mockSocialPosts, mockUsers } from '@/data/mock';

type Tab = 'players' | 'rankings' | 'highlights';

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('players');

  const usersMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Communauté</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <ChipGroup
          options={[
            { label: 'Joueurs', value: 'players' },
            { label: 'Classement', value: 'rankings' },
            { label: 'Highlights', value: 'highlights' },
          ]}
          selected={tab}
          onSelect={(v) => setTab(v as Tab)}
        />
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {tab === 'players' && (
          <>
            <SectionHeader title="Joueurs à proximité" />
            {mockUsers.filter((u) => u.id !== 'user-1').map((user) => (
              <PlayerListItem
                key={user.id}
                user={user}
                distance="1.5 km"
                onAdd={() => {}}
              />
            ))}
          </>
        )}

        {tab === 'rankings' && (
          <>
            <LeaderboardPodium entries={mockLeaderboard} users={usersMap} />
            <SectionHeader title="Classement général" action="Amis" onAction={() => router.push('/rankings')} />
            {mockLeaderboard.map((entry) => {
              const user = getUserById(entry.userId);
              if (!user) return null;
              return (
                <PlayerListItem key={entry.userId} user={user} rank={entry.rank} score={entry.score} />
              );
            })}
          </>
        )}

        {tab === 'highlights' && (
          <>
            <SectionHeader title="Highlights récents" action="Voir tout" onAction={() => router.push('/social/feed')} />
            {mockSocialPosts.map((post) => {
              const author = getUserById(post.authorId);
              if (!author) return null;
              return <HighlightCard key={post.id} post={post} author={author} />;
            })}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { ...Typography.h1, color: Colors.text, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.lg },
  tabs: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.md },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xxl },
  bottomSpacer: { height: 100 },
});
