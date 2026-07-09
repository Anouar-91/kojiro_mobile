import { useLocalSearchParams } from 'expo-router';
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
import { invitePlayerToMatch } from '@/services/invites';
import { useFriendStore } from '@/store/friendStore';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { User } from '@/types';
import { canChangeAttendance } from '@/utils/matchAttendance';

export default function InvitePlayersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const profiles = useProfileStore((s) => s.profiles);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const friendIds = useFriendStore((s) => s.friendIds);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProfiles().finally(() => setLoading(false));
  }, [fetchProfiles]);

  const attendeeIds = useMemo(
    () => new Set(match?.attendees.filter((a) => a.userId).map((a) => a.userId!) ?? []),
    [match]
  );

  const inviteablePlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool =
      match?.visibility === 'friends_only'
        ? profiles.filter((p) => friendIds.includes(p.id))
        : profiles;

    return pool.filter((p) => {
      if (p.id === user?.id) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.city.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [profiles, user?.id, search, match?.visibility, friendIds]);

  const handleInvite = useCallback(
    async (player: User) => {
      if (!match || !user) return;
      if (user.id !== match.organizerId) {
        Alert.alert('Erreur', 'Seul l\'organisateur peut inviter des joueurs.');
        return;
      }
      if (attendeeIds.has(player.id) && !invitedIds.has(player.id)) {
        Alert.alert('Déjà inscrit', `${player.name} fait déjà partie de ce match.`);
        return;
      }

      setInvitingId(player.id);
      try {
        await invitePlayerToMatch(match.id, player.id);
        setInvitedIds((prev) => new Set(prev).add(player.id));
        await fetchMatches();
        Alert.alert('Invitation envoyée', `${player.name} a reçu une notification.`);
      } catch (e) {
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Invitation impossible');
      } finally {
        setInvitingId(null);
      }
    },
    [match, user, attendeeIds, invitedIds, fetchMatches]
  );

  if (!match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Match introuvable</Text>
      </View>
    );
  }

  if (user?.id !== match.organizerId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Seul l'organisateur peut inviter des joueurs.</Text>
      </View>
    );
  }

  if (!canChangeAttendance(match)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Ce match n'accepte plus d'invitations.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Inviter des joueurs</Text>
      <Text style={styles.subtitle}>{match.title}</Text>

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
          {match.visibility === 'friends_only'
            ? 'Aucun ami à inviter. Ajoute des amis depuis Communauté.'
            : search
              ? 'Aucun joueur trouvé.'
              : 'Aucun autre joueur inscrit sur Kojiro pour l\'instant.'}
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
              onAdd={
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
          Les joueurs invités reçoivent une notification et peuvent confirmer leur présence depuis le match.
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
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.xl },
  loader: { marginTop: Spacing.xxxl },
  muted: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl },
  hint: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
});
