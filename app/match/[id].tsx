import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';

import { MatchOrganizerSteps } from '@/components/match/MatchOrganizerSteps';
import { DevFillMatchPanel } from '@/components/dev/DevFillMatchPanel';

import { Badge } from '@/components/ui/Badge';
import { AttendanceActions, AttendanceSection } from '@/components/match/PlayerComponents';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { fetchMatchComposition, startMatch } from '@/services/composition';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useMatchStore } from '@/store/matchStore';
import { getUsersByAttendance, useProfileStore } from '@/store/profileStore';
import { AttendanceStatus } from '@/types';
import { formatMatchDate, formatPrice, getMatchFormatDescription } from '@/utils/formatters';
import { canSetPresent, isMatchFull } from '@/utils/matchAttendance';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const updateAttendance = useMatchStore((s) => s.updateAttendance);
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const getProfile = useProfileStore((s) => s.getProfile);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const isFriend = useFriendStore((s) => s.isFriend);
  const [hasComposition, setHasComposition] = useState(false);

  useEffect(() => {
    if (!match) return;
    fetchMatchComposition(match.id)
      .then((c) => setHasComposition(Boolean(c?.validatedAt && (c.lineups.length ?? 0) > 0)))
      .catch(() => setHasComposition(false));
  }, [match?.id, match?.status]);

  if (!match) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Match introuvable</Text>
      </View>
    );
  }

  const presentUsers = getUsersByAttendance(match, 'present', getProfile);
  const maybeUsers = getUsersByAttendance(match, 'maybe', getProfile);
  const absentUsers = getUsersByAttendance(match, 'absent', getProfile);

  const myAttendance = match.attendees.find((a) => a.userId === user?.id)?.status ?? 'pending';

  const handleStatusChange = async (status: AttendanceStatus) => {
    if (!user) return;
    try {
      await updateAttendance(match.id, user.id, status);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de mettre à jour');
    }
  };

  const isOrganizer = user?.id === match.organizerId;
  const isCompleted = match.status === 'completed';
  const matchIsFull = isMatchFull(match);
  const userCanSetPresent = user ? canSetPresent(match, user.id) : false;
  const isFriendsOnly = match.visibility === 'friends_only';
  const canJoin =
    !isFriendsOnly ||
    isOrganizer ||
    (user && isFriend(match.organizerId)) ||
    match.attendees.some((a) => a.userId === user?.id);

  const handleStartMatch = async () => {
    try {
      await startMatch(match.id);
      await fetchMatches(user?.id);
      Alert.alert("C'est parti !", 'Le match est en cours. Bon jeu !');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de démarrer');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {match.imageUrl && (
        <Image source={{ uri: match.imageUrl }} style={styles.hero} contentFit="cover" />
      )}

      <View style={styles.header}>
        <View style={styles.formatRow}>
          <Text style={styles.format}>{getMatchFormatDescription(match.format, match.substitutesPerTeam)}</Text>
          {isFriendsOnly && <Badge label="Entre amis" variant="secondary" />}
          {isCompleted && <Badge label="Terminé" variant="success" />}
          {match.status === 'live' && <Badge label="En cours" variant="primary" />}
          {matchIsFull && !isCompleted && <Badge label="Complet" variant="secondary" />}
        </View>
        <Text style={styles.title}>{match.title}</Text>
        <Text style={styles.date}>{formatMatchDate(match.date, match.time)}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location" size={18} color={Colors.primary} />
          <View>
            <Text style={styles.locationName}>{match.location.name}</Text>
            <Text style={styles.locationAddress}>{match.location.address}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatPrice(match.pricePerPlayer)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>{presentUsers.length}/{match.maxPlayers} joueurs</Text>
          </View>
        </View>
      </View>

      {isOrganizer && !isCompleted && (
        <View style={styles.section}>
          <MatchOrganizerSteps
            match={match}
            presentCount={presentUsers.length}
            hasComposition={hasComposition}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ma présence</Text>
        {!canJoin && !isOrganizer ? (
          <Text style={styles.restricted}>
            Match réservé aux amis de l'organisateur. Ajoute-le en ami pour participer.
          </Text>
        ) : (
          <>
            <AttendanceActions
              currentStatus={myAttendance}
              onStatusChange={handleStatusChange}
              canSetPresent={userCanSetPresent}
            />
            {matchIsFull && myAttendance !== 'present' && (
              <Text style={styles.fullHint}>Ce match est complet. Tu peux répondre « Peut-être » ou « Absent ».</Text>
            )}
            <ProgressBar
              progress={presentUsers.length / match.maxPlayers}
              label={`${presentUsers.length}/${match.maxPlayers} confirmés`}
              showLabel
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Participants</Text>
        <AttendanceSection title="Présents" users={presentUsers} statusColor={Colors.success} />
        <AttendanceSection title="En attente" users={getUsersByAttendance(match, 'pending', getProfile)} statusColor={Colors.textMuted} />
        <AttendanceSection title="Peut-être" users={maybeUsers} statusColor={Colors.warning} />
        <AttendanceSection title="Absents" users={absentUsers} statusColor={Colors.error} />
      </View>

      {match.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{match.description}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {isOrganizer && !isCompleted && match.status === 'upcoming' && hasComposition && (
          <Button
            title="Démarrer le match"
            onPress={handleStartMatch}
            icon="play-circle-outline"
            fullWidth
          />
        )}
        {isOrganizer && !isCompleted && (
          <Button
            title="Terminer le match"
            onPress={() => router.push({ pathname: '/match/complete', params: { id: match.id } })}
            icon="flag-outline"
            fullWidth
            variant={match.status === 'live' ? 'primary' : 'secondary'}
          />
        )}
        {!isCompleted && (
          <>
            <Button
              title={isOrganizer ? 'Composer les équipes' : 'Voir la composition'}
              onPress={() =>
                router.push(
                  isOrganizer
                    ? { pathname: '/match/teams', params: { id: match.id } }
                    : { pathname: '/match/lineup', params: { id: match.id } }
                )
              }
              icon="football-outline"
              fullWidth
            />
            <Button
              title="Chat du match"
              onPress={() => router.push({ pathname: '/match/chat', params: { id: match.id } })}
              variant="secondary"
              icon="chatbubbles-outline"
              fullWidth
            />
          </>
        )}
        {!isCompleted && (
          <Button
            title="Inviter des joueurs"
            onPress={() => router.push({ pathname: '/match/invite', params: { id: match.id } })}
            variant="outline"
            icon="person-add-outline"
            fullWidth
          />
        )}
        {__DEV__ && isOrganizer && !isCompleted && (
          <DevFillMatchPanel
            match={match}
            onFilled={async () => {
              await fetchMatches(user?.id);
              await fetchProfiles();
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xxxl },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  notFoundText: { ...Typography.body, color: Colors.textMuted },
  hero: { width: '100%', height: 180 },
  header: { padding: Spacing.xxl },
  format: { ...Typography.caption, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase' },
  formatRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { ...Typography.h2, color: Colors.text, marginTop: Spacing.xs },
  date: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.xs },
  locationRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, alignItems: 'flex-start' },
  locationName: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
  locationAddress: { ...Typography.caption, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...Typography.caption, color: Colors.textSecondary },
  section: { paddingHorizontal: Spacing.xxl, marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.md },
  description: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  restricted: { ...Typography.body, color: Colors.textMuted, fontStyle: 'italic' },
  fullHint: { ...Typography.caption, color: Colors.warning, marginBottom: Spacing.sm },
  actions: { paddingHorizontal: Spacing.xxl, gap: Spacing.md },
});
