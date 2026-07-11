import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HighlightCard, LeaderboardPodium, PlayerListItem } from '@/components/community/CommunityComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchFriendsLeaderboard } from '@/services/leaderboard';
import { fetchFriendSuggestions, FriendSuggestion } from '@/services/friendSuggestions';
import { searchProfiles } from '@/services/profiles';
import { fetchSocialPosts, subscribeToSocialPosts } from '@/services/social';
import { getFriendshipState } from '@/services/friends';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useProfileStore } from '@/store/profileStore';
import { LeaderboardEntry, SocialPost, User } from '@/types';
import { openUserProfile } from '@/utils/profileNavigation';

type Tab = 'friends' | 'players' | 'rankings' | 'highlights';

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const profiles = useProfileStore((s) => s.profiles);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const getProfile = useProfileStore((s) => s.getProfile);
  const friendIds = useFriendStore((s) => s.friendIds);
  const friendRequests = useFriendStore((s) => s.requests);
  const getIncomingRequests = useFriendStore((s) => s.getIncomingRequests);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const declineRequest = useFriendStore((s) => s.declineRequest);
  const cancelRequest = useFriendStore((s) => s.cancelRequest);
  const removeFriend = useFriendStore((s) => s.removeFriend);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);

  const [tab, setTab] = useState<Tab>('friends');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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
      setLeaderboard(await fetchFriendsLeaderboard(friendIds, user.id));
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

  const loadSuggestions = useCallback(async () => {
    if (!user) return;
    setLoadingSuggestions(true);
    try {
      const friendNames = Object.fromEntries(
        friendIds
          .map((id) => {
            const profile = getProfile(id);
            return profile ? ([id, profile.name] as const) : null;
          })
          .filter(Boolean) as [string, string][]
      );
      setSuggestions(
        await fetchFriendSuggestions(user, friendIds, friendRequests, friendNames)
      );
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [user, friendIds, friendRequests, getProfile]);

  useEffect(() => {
    if (tab !== 'players') return;

    const q = search.trim();
    if (q.length >= 2) {
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
    }

    setSearchResults([]);
    setSearching(false);
    loadSuggestions();
  }, [search, tab, user?.id, loadSuggestions]);

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

  const handleDecline = (requestId: string, name: string) => {
    Alert.alert('Refuser la demande', `Refuser la demande de ${name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: async () => {
          try {
            await declineRequest(requestId);
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de refuser');
          }
        },
      },
    ]);
  };

  const handleRemoveFriend = (friend: User) => {
    Alert.alert('Retirer des amis', `Retirer ${friend.name} de tes amis ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await removeFriend(user.id, friend.id);
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de retirer cet ami');
          }
        },
      },
    ]);
  };

  const handleCancelRequest = (requestId: string, name: string) => {
    Alert.alert('Annuler la demande', `Annuler ta demande d'ami envoyée à ${name} ?`, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler la demande',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelRequest(requestId);
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'annuler');
          }
        },
      },
    ]);
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
              { label: 'Classement amis', value: 'rankings' },
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
                      onPress={() => openUserProfile(router, from.id)}
                      onAccept={() => handleAccept(req.id, from.name)}
                      onDecline={() => handleDecline(req.id, from.name)}
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
                <PlayerListItem
                  key={player.id}
                  user={player}
                  friendState="friends"
                  onPress={() => openUserProfile(router, player.id)}
                  onRemove={() => handleRemoveFriend(player)}
                />
              ))
            )}
          </>
        )}

        {tab === 'players' && (
          <>
            {search.trim().length < 2 && (
              <>
                <SectionHeader title="Suggestions pour toi" />
                {loadingSuggestions ? (
                  <ActivityIndicator color={Colors.primary} style={styles.loader} />
                ) : suggestions.length === 0 ? (
                  <Text style={styles.hint}>
                    Aucune suggestion pour le moment. Complète ta ville dans ton profil pour
                    découvrir des joueurs près de chez toi.
                  </Text>
                ) : (
                  suggestions.map(({ user: player, label }) => {
                    const state = user
                      ? getFriendshipState(user.id, player.id, friendRequests)
                      : 'none';
                    const request = user
                      ? friendRequests.find(
                          (r) =>
                            (r.fromUserId === user.id && r.toUserId === player.id) ||
                            (r.fromUserId === player.id && r.toUserId === user.id)
                        )
                      : undefined;
                    return (
                      <PlayerListItem
                        key={player.id}
                        user={player}
                        subtitle={label}
                        distance={player.city}
                        friendState={state}
                        onPress={() => openUserProfile(router, player.id)}
                        onAdd={() => handleAddFriend(player)}
                        onCancel={
                          state === 'pending_sent' && request
                            ? () => handleCancelRequest(request.id, player.name)
                            : undefined
                        }
                      />
                    );
                  })
                )}
              </>
            )}

            <SectionHeader title="Rechercher un joueur" />
            {search.trim().length >= 2 ? (
              searching ? (
                <ActivityIndicator color={Colors.primary} style={styles.loader} />
              ) : searchResults.length === 0 ? (
                <Text style={styles.empty}>Aucun joueur trouvé pour « {search} »</Text>
              ) : (
                searchResults.map((player) => {
                  const state = user ? getFriendshipState(user.id, player.id, friendRequests) : 'none';
                  const request = user
                    ? friendRequests.find(
                        (r) =>
                          (r.fromUserId === user.id && r.toUserId === player.id) ||
                          (r.fromUserId === player.id && r.toUserId === user.id)
                      )
                    : undefined;
                  return (
                    <PlayerListItem
                      key={player.id}
                      user={player}
                      distance={player.city}
                      friendState={state}
                      onPress={() => openUserProfile(router, player.id)}
                      onAdd={() => handleAddFriend(player)}
                      onCancel={
                        state === 'pending_sent' && request
                          ? () => handleCancelRequest(request.id, player.name)
                          : undefined
                      }
                    />
                  );
                })
              )
            ) : (
              <Text style={styles.hint}>
                Tape au moins 2 caractères (nom, ville ou email) pour chercher un joueur précis.
              </Text>
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
                {friendIds.length === 0 && (
                  <Text style={styles.empty}>Ajoute des amis pour comparer vos scores.</Text>
                )}
                <SectionHeader title="Classement amis" action="Voir tout" onAction={() => router.push('/rankings')} />
                {leaderboard.map((entry) => {
                  const profile = getProfile(entry.userId);
                  if (!profile) return null;
                  return (
                    <PlayerListItem
                      key={entry.userId}
                      user={profile}
                      rank={entry.rank}
                      score={entry.score}
                      onPress={() => openUserProfile(router, profile.id)}
                    />
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
                return (
                  <HighlightCard
                    key={post.id}
                    post={post}
                    author={author}
                    onAuthorPress={() => openUserProfile(router, author.id)}
                  />
                );
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
