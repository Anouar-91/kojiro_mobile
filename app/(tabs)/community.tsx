import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HighlightCard, LeaderboardPodium, PlayerListItem } from '@/components/community/CommunityComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { mockSocialPosts } from '@/data/mock';
import { fetchLeaderboard } from '@/services/leaderboard';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { LeaderboardEntry, User } from '@/types';

type Tab = 'players' | 'rankings' | 'highlights';

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const profiles = useProfileStore((s) => s.profiles);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const getProfile = useProfileStore((s) => s.getProfile);
  const [tab, setTab] = useState<Tab>('players');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);

  const otherPlayers = profiles.filter((p) => p.id !== user?.id);
  const usersMap = Object.fromEntries(profiles.map((u) => [u.id, u])) as Record<string, User>;

  const loadRankings = useCallback(async () => {
    setLoadingRankings(true);
    try {
      const entries = await fetchLeaderboard();
      setLeaderboard(entries);
    } finally {
      setLoadingRankings(false);
    }
  }, []);

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles();
  }, [profiles.length, fetchProfiles]);

  useEffect(() => {
    if (tab === 'rankings') loadRankings();
  }, [tab, loadRankings]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Communauté</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.tabs}>
          <ChipGroup
            options={[
              { label: 'Joueurs', value: 'players' },
              { label: 'Classement', value: 'rankings' },
              { label: 'Highlights', value: 'highlights' },
            ]}
            selected={tab}
            onSelect={(v) => setTab(v as Tab)}
          />
        </View>

        {tab === 'players' && (
          <>
            <SectionHeader title="Joueurs sur Kojiro" />
            {otherPlayers.length === 0 ? (
              <Text style={styles.empty}>Invite des amis à s'inscrire !</Text>
            ) : (
              otherPlayers.map((player) => (
                <PlayerListItem
                  key={player.id}
                  user={player}
                  onAdd={() => {}}
                />
              ))
            )}
          </>
        )}

        {tab === 'rankings' && (
          <>
            {loadingRankings ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : (
              <>
                <LeaderboardPodium entries={leaderboard.slice(0, 3)} users={usersMap} />
                <SectionHeader title="Classement général" action="Amis" onAction={() => router.push('/rankings')} />
                {leaderboard.map((entry) => {
                  const profile = getProfile(entry.userId);
                  if (!profile) return null;
                  return (
                    <PlayerListItem key={entry.userId} user={profile} rank={entry.rank} score={entry.score} />
                  );
                })}
              </>
            )}
          </>
        )}

        {tab === 'highlights' && (
          <>
            <SectionHeader title="Highlights récents" action="Voir tout" onAction={() => router.push('/social/feed')} />
            {mockSocialPosts.map((post) => {
              const author = getProfile(post.authorId);
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
  scrollContent: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.lg },
  tabs: { marginBottom: Spacing.md },
  empty: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.xxl },
  loader: { marginVertical: Spacing.xxxl },
  bottomSpacer: { height: 100 },
});
