import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NearbyMatchCard, UpcomingMatchCard } from '@/components/home/MatchCards';
import { ActiveFriendsRow, NewsCard } from '@/components/home/SocialRow';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { fetchNews } from '@/services/news';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { NewsItem } from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const matches = useMatchStore((s) => s.matches);
  const unreadCount = useMatchStore((s) => s.unreadCount());
  const getOtherProfiles = useProfileStore((s) => s.getOtherProfiles);
  const refresh = useAppRefresh();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const upcomingMatches = matches.filter((m) => m.status === 'upcoming').slice(0, 3);
  const activeFriends = getOtherProfiles(user?.id).slice(0, 6);

  useEffect(() => {
    fetchNews().then(setNews).catch(() => setNews([]));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), fetchNews().then(setNews).catch(() => {})]);
    setRefreshing(false);
  }, [refresh]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Salut {user?.name.split(' ')[0]} ! 👋</Text>
          <Text style={styles.subGreeting}>Prêt pour un match aujourd'hui ?</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={24} color={Colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifCount}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <Button
          title="Créer un match"
          onPress={() => router.push('/match/create')}
          icon="add-circle-outline"
          fullWidth
          size="lg"
        />

        <SectionHeader
          title="Prochains matchs"
          action="Voir tout"
          onAction={() => router.push('/(tabs)/matches')}
        />
        {upcomingMatches.map((match) => (
          <UpcomingMatchCard
            key={match.id}
            match={match}
            onPress={() => router.push(`/match/${match.id}`)}
          />
        ))}

        <SectionHeader
          title="Matchs autour de toi"
          action="Carte"
          onAction={() => router.push('/map')}
        />
        {upcomingMatches.slice(0, 2).map((match, i) => (
          <NearbyMatchCard
            key={match.id}
            match={match}
            distance={1.2 + i * 0.8}
            onPress={() => router.push(`/match/${match.id}`)}
          />
        ))}

        <SectionHeader title="Amis actifs" />
        <ActiveFriendsRow friends={activeFriends} />

        <SectionHeader title="Actualités" action="Plus" onAction={() => {}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {news.map((item) => (
            <NewsCard
              key={item.id}
              title={item.title}
              summary={item.summary}
              imageUrl={item.imageUrl}
              category={item.category}
            />
          ))}
        </ScrollView>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  greeting: {
    ...Typography.h2,
    color: Colors.text,
  },
  subGreeting: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCount: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
  },
  bottomSpacer: {
    height: 100,
  },
});
