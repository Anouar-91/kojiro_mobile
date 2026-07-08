import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HighlightCard, LeaderboardPodium, PlayerListItem } from '@/components/community/CommunityComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchLeaderboard, fetchFriendsLeaderboard } from '@/services/leaderboard';
import { searchProfiles } from '@/services/profiles';
import { fetchSocialPosts, subscribeToSocialPosts } from '@/services/social';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useProfileStore } from '@/store/profileStore';
import { LeaderboardEntry, SocialPost, User } from '@/types';

type Tab = 'friends' | 'players' | 'rankings' | 'highlights';

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const profiles = useProfileStore((s) => s.profiles);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const getProfile = useProfileStore((s) => s.getProfile);
  const friendIds = useFriendStore((s) => s.friendIds);
  const getFriendState = useFriendStore((s) => s.getState);
  const getIncomingRequests = useFriendStore((s) => s.getIncomingRequests);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);

  const [tab, setTab] = useState<Tab>('friends');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const friends = friendIds
    .map((id) => getProfile(id))
    .filter(Boolean) as User[];

  const filterBySearch = useCallback(
    (players: User[]) => {
      const q = search.trim().toLowerCase();
      if (!q) return players;
      return players.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    },
    [search]
  );

  const filteredFriends = useMemo(() => filterBySearch(friends), [friends, filterBySearch]);
  const usersMap = Object.fromEntries(profiles.map((u) => [u.id, u])) as Record<string, User>;
  const incomingRequests = user ? getIncomingRequests(user.id) : [];

  const loadRankings = useCallback(async () => {
    if (!user) return;
    setLoadingRankings(true);
    try {
      const entries =
        friendIds.length > 0
          ? await fetchFriendsLeaderboard(friendIds, user.id)
          : await fetchLeaderboard();
      setLeaderboard(entries);
    } finally {
      setLoadingRankings(false);
    }
  }, [user, friendIds]);

  const loadHighlights = useCallback(async () => {
    setLoadingHighlights(true);
    try {
      const posts = await fetchSocialPosts(5);
      setSocialPosts(posts);
    } finally {
      setLoadingHighlights(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'players') return;

    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchProfiles(q);
        setSearchResults(results.filter((p) => p.id !== user?.id));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search, tab, user?.id]);

  useEffect(() => {
    if (user) fetchFriends(user.id);
  }, [user, fetchFriends]);

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles();
  }, [profiles.length, fetchProfiles]);

  useEffect(() => {
    if (tab === 'rankings') loadRankings();
    if (tab === 'highlights') loadHighlights();
  }, [tab, loadRankings, loadHighlights]);

  useEffect(() => {
    const unsubscribe = subscribeToSocialPosts(() => {
      loadHighlights().catch(() => {});
    });
    return unsubscribe;
  }, [loadHighlights]);

  const handleAddFriend = async (player: User) => {
    if (!user) return;
    try {
      await sendRequest(user.id, player.id, user.name);
      Alert.alert('Demande envoyée', `${player.name} recevra une notification.`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'envoyer la demande');
    }
  };

  const handleAccept = async (requestId: string, name: string) => {
    try {
      await acceptRequest(requestId);
      Alert.alert('Ami ajouté', `${name} fait maintenant partie de tes amis.`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'accepter');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Communauté</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.tabs}>
          <ChipGroup
            options={[
              { label: `Amis${friends.length ? ` (${friends.length})` : ''}`, value: 'friends' },
              { label: 'Découvrir', value: 'players' },
              { label: 'Classement', value: 'rankings' },
              { label: 'Highlights', value: 'highlights' },
            ]}
            selected={tab}
            onSelect={(v) => {
              setTab(v as Tab);
              setSearch('');
            }}
          />
        </View>

        {(tab === 'friends' || tab === 'players') && (
          <Input
            placeholder={tab === 'friends' ? 'Rechercher un ami...' : 'Nom, ville ou email...'}
            value={search}
            onChangeText={setSearch}
            icon="search-outline"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        {tab === 'friends' && (
          <>
            {incomingRequests.length > 0 && (
              <>
                <SectionHeader title="Demandes reçues" />
                {incomingRequests.map((req) => {
                  const from = getProfile(req.fromUserId);
                  if (!from) return null;
                  return (
                    <PlayerListItem
                      key={req.id}
                      user={from}
                      friendState="pending_received"
                      onAccept={() => handleAccept(req.id, from.name)}
                    />
                  );
                })}
              </>
            )}

            <SectionHeader title="Mes amis" />
            {friends.length === 0 ? (
              <Text style={styles.empty}>
                Pas encore d'amis. Va dans Découvrir pour en ajouter !
              </Text>
            ) : filteredFriends.length === 0 ? (
              <Text style={styles.empty}>Aucun ami trouvé pour « {search} »</Text>
            ) : (
              filteredFriends.map((player) => (
                <PlayerListItem key={player.id} user={player} friendState="friends" />
              ))
            )}
          </>
        )}

        {tab === 'players' && (
          <>
            <SectionHeader title="Rechercher un joueur" />
            {search.trim().length < 2 ? (
              <Text style={styles.hint}>
                Tape au moins 2 caractères (nom, ville ou email) pour trouver un joueur à ajouter.
              </Text>
            ) : searching ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.empty}>Aucun joueur trouvé pour « {search} »</Text>
            ) : (
              searchResults.map((player) => (
                <PlayerListItem
                  key={player.id}
                  user={player}
                  distance={player.city}
                  friendState={user ? getFriendState(user.id, player.id) : 'none'}
                  onAdd={() => handleAddFriend(player)}
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
                <SectionHeader title="Classement" action="Voir tout" onAction={() => router.push('/rankings')} />
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
            {loadingHighlights ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : socialPosts.length === 0 ? (
              <Text style={styles.empty}>Publie ton premier highlight depuis le feed !</Text>
            ) : (
              socialPosts.map((post) => {
                const author = getProfile(post.authorId);
                if (!author) return null;
                return <HighlightCard key={post.id} post={post} author={author} />;
              })
            )}
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
  hint: { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 },
  loader: { marginVertical: Spacing.xxxl },
  bottomSpacer: { height: 100 },
});
