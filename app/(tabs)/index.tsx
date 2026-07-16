import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NearbyMatchCard, UpcomingMatchCard } from '@/components/home/MatchCards';
import { ActiveFriendsRow, NewsCard } from '@/components/home/SocialRow';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useNow } from '@/hooks/useNow';
import { fetchNews } from '@/services/news';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { NewsItem, User } from '@/types';
import { NEARBY_MATCH_RADIUS_KM, sortByProximity } from '@/utils/geo';
import { isUserRegisteredForMatch } from '@/utils/matchAttendance';
import { isMatchListedAsUpcoming } from '@/utils/matchDates';
import { openUserProfile } from '@/utils/profileNavigation';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const matches = useMatchStore((s) => s.matches);
  const unreadCount = useMatchStore((s) => s.unreadNotificationsCount);
  const getProfile = useProfileStore((s) => s.getProfile);
  const friendIds = useFriendStore((s) => s.friendIds);
  const refresh = useAppRefresh();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow();

  const myUpcomingMatches = useMemo(
    () =>
      matches
        .filter((m) => isMatchListedAsUpcoming(m, now) && isUserRegisteredForMatch(m, user?.id))
        .slice(0, 3),
    [matches, user?.id, now]
  );
  const { position: userPosition } = useCurrentLocation(user ?? undefined);
  const nearbyMatches = useMemo(() => {
    return sortByProximity(
      matches.filter((m) => m.status === 'upcoming' && isMatchListedAsUpcoming(m, now)),
      userPosition,
      (m) => m.location
    )
      .map(({ item, distance }) => ({ match: item, distance }))
      .slice(0, 2);
  }, [matches, userPosition, now]);
  const activeFriends = friendIds
    .map((id) => getProfile(id))
    .filter((p): p is User => Boolean(p))
    .slice(0, 6);

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
          title="Mes prochains matchs"
          action="Voir tout"
          onAction={() => router.push('/(tabs)/matches')}
        />
        {myUpcomingMatches.length === 0 ? (
          <Text style={styles.emptySection}>
            Tu n'as pas encore de match prévu. Crée-en un ou rejoins-en un à proximité.
          </Text>
        ) : (
          myUpcomingMatches.map((match) => (
            <UpcomingMatchCard
              key={match.id}
              match={match}
              onPress={() => router.push(`/match/${match.id}`)}
            />
          ))
        )}

        <SectionHeader
          title="Matchs autour de toi"
          action="Carte"
          onAction={() => router.push('/map')}
        />
        {nearbyMatches.length === 0 ? (
          <Text style={styles.emptySection}>
            Aucun match à moins de {NEARBY_MATCH_RADIUS_KM} km. Crée-en un ou élargis ta zone sur la carte.
          </Text>
        ) : (
          nearbyMatches.map(({ match, distance }) => (
            <NearbyMatchCard
              key={match.id}
              match={match}
              distance={distance}
              onPress={() => router.push(`/match/${match.id}`)}
            />
          ))
        )}

        <SectionHeader
          title="Amis actifs"
          action={activeFriends.length === 0 ? undefined : 'Voir tout'}
          onAction={() => router.push('/(tabs)/community')}
        />
        {activeFriends.length === 0 ? (
          <Text style={styles.emptyFriends}>Ajoute des amis depuis l'onglet Communauté</Text>
        ) : (
          <ActiveFriendsRow
            friends={activeFriends}
            onFriendPress={(friend) => openUserProfile(router, friend.id)}
          />
        )}

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
  emptyFriends: {
    ...Typography.body,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
  },
  emptySection: {
    ...Typography.body,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
});
