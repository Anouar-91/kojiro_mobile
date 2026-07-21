import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PlayerListItem } from '@/components/community/CommunityComponents';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { invitePlayerToMatch, suggestPlayerToMatch } from '@/services/invites';
import { useEnsureMatch } from '@/hooks/useEnsureMatch';
import { useFriendStore } from '@/store/friendStore';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { User } from '@/types';
import { canInvitePlayers, canSuggestPlayers } from '@/utils/matchAttendance';
import { openUserProfile } from '@/utils/profileNavigation';

export default function InvitePlayersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { match, loading: matchLoading } = useEnsureMatch(id);
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const profiles = useProfileStore((s) => s.profiles);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const friendIds = useFriendStore((s) => s.friendIds);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const isOrganizer = Boolean(user?.id && match?.organizerId === user.id);
  const isSuggestMode = Boolean(match && !isOrganizer && canSuggestPlayers(match, user?.id));

  useEffect(() => {
    fetchProfiles().finally(() => setLoading(false));
  }, [fetchProfiles]);

  const attendeeIds = useMemo(
    () => new Set(match?.attendees.filter((a) => a.userId).map((a) => a.userId!) ?? []),
    [match]
  );

  const inviteablePlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = profiles.filter((p) => friendIds.includes(p.id));

    return pool.filter((p) => {
      if (p.id === user?.id) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.city.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [profiles, user?.id, search, friendIds]);

  const handleInvite = useCallback(
    async (player: User) => {
      if (!match || !user) return;
      if (attendeeIds.has(player.id) && !invitedIds.has(player.id)) {
        const isPending = match.attendees.find((a) => a.userId === player.id)?.status === 'pending';
        if (!isPending) {
          Alert.alert('Déjà inscrit', `${player.name} fait déjà partie de ce match.`);
          return;
        }
      }

      setInvitingId(player.id);
      try {
        if (isSuggestMode) {
          await suggestPlayerToMatch(match.id, player.id);
          setInvitedIds((prev) => new Set(prev).add(player.id));
          Alert.alert(
            'Suggestion envoyée',
            `${player.name} a été proposé à l'organisateur. Tu seras notifié si la suggestion est refusée.`
          );
        } else {
          await invitePlayerToMatch(match.id, player.id);
          setInvitedIds((prev) => new Set(prev).add(player.id));
          await fetchMatches();
          Alert.alert('Invitation envoyée', `${player.name} a reçu une notification.`);
        }
      } catch (e) {
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Action impossible');
      } finally {
        setInvitingId(null);
      }
    },
    [match, user, attendeeIds, invitedIds, fetchMatches, isSuggestMode]
  );

  if (matchLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Match introuvable</Text>
      </View>
    );
  }

  if (!isOrganizer && !canSuggestPlayers(match, user?.id)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Tu ne peux pas inviter de joueurs pour ce match.</Text>
      </View>
    );
  }

  if (!canInvitePlayers(match)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Ce match n'accepte plus d'invitations.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isSuggestMode ? 'Proposer un ami' : 'Inviter des amis'}</Text>
      <Text style={styles.subtitle}>{match.title}</Text>
      {isSuggestMode && (
        <Text style={styles.modeHint}>
          L'organisateur doit valider ta suggestion avant que ton ami reçoive une invitation.
        </Text>
      )}

      <Input
        placeholder="Rechercher par nom ou ville..."
        value={search}
        onChangeText={setSearch}
        icon="search-outline"
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : inviteablePlayers.length === 0 ? (
        <Text style={styles.muted}>
          {search
            ? 'Aucun ami trouvé.'
            : isSuggestMode
              ? 'Aucun ami à proposer. Ajoute des amis depuis Communauté.'
              : 'Aucun ami à inviter. Ajoute des amis depuis Communauté.'}
        </Text>
      ) : (
        inviteablePlayers.map((player) => {
          const isAttendee = attendeeIds.has(player.id);
          const wasInvited = invitedIds.has(player.id);
          const isPending = match.attendees.find((a) => a.userId === player.id)?.status === 'pending';

          return (
            <PlayerListItem
              key={player.id}
              user={player}
              distance={player.city}
              onPress={() => openUserProfile(router, player.id)}
              onInvite={
                isAttendee && !isPending && !wasInvited
                  ? undefined
                  : invitingId === player.id
                    ? undefined
                    : () => handleInvite(player)
              }
            />
          );
        })
      )}

      {(invitedIds.size > 0 || inviteablePlayers.some((p) => attendeeIds.has(p.id))) && (
        <Text style={styles.hint}>
          {isSuggestMode
            ? 'Les suggestions en attente sont visibles par l\'organisateur qui peut les approuver ou refuser.'
            : 'Les joueurs invités reçoivent une notification et peuvent confirmer leur présence depuis le match.'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.xxl },
  title: { ...Typography.h2, color: Colors.text },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
  modeHint: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.xl },
  loader: { marginTop: Spacing.xxxl },
  muted: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl },
  hint: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
});
