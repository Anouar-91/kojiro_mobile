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
import { AttendanceStatus, User } from '@/types';
import { formatMatchDate, formatPrice, getMatchFormatDescription } from '@/utils/formatters';
import {
  canJoinWaitlist,
  canManageRoster as canOrganizerManageRoster,
  canChangeAttendance,
  canSetPresent,
  getAttendanceLockMessage,
  getWaitlistPosition,
  isMatchFull,
  isOnWaitlist,
} from '@/utils/matchAttendance';

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  maybe: 'Peut-être',
  pending: 'Invitation en attente',
  waitlist: 'Liste d\'attente',
};

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const updateAttendance = useMatchStore((s) => s.updateAttendance);
  const removeAttendeeByOrganizer = useMatchStore((s) => s.removeAttendeeByOrganizer);
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
  const attendanceOpen = canChangeAttendance(match);
  const matchIsFull = isMatchFull(match);
  const userCanSetPresent = user ? canSetPresent(match, user.id) : false;
  const userOnWaitlist = user ? isOnWaitlist(match, user.id) : false;
  const waitlistPosition = user ? getWaitlistPosition(match, user.id) : null;
  const userCanJoinWaitlist = user ? canJoinWaitlist(match, user.id) : false;
  const isFriendsOnly = match.visibility === 'friends_only';
  const canJoin =
    !isFriendsOnly ||
    isOrganizer ||
    (user && isFriend(match.organizerId)) ||
    match.attendees.some((a) => a.userId === user?.id);

  const handleJoinWaitlist = async () => {
    if (!user) return;
    try {
      await updateAttendance(match.id, user.id, 'waitlist');
      Alert.alert(
        'Liste d\'attente',
        'Tu seras notifié si une place se libère. Le premier à confirmer sa présence réserve la place.'
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de rejoindre la liste');
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!user) return;
    try {
      await updateAttendance(match.id, user.id, 'absent');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de quitter la liste');
    }
  };

  const canManageRoster = canOrganizerManageRoster(match, isOrganizer);
  const handleRemovePlayer = (player: User) => {
    if (!canManageRoster || player.id === match.organizerId) return;
    Alert.alert(
      'Retirer du match',
      `Retirer ${player.name} de l'effectif ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAttendeeByOrganizer(match.id, player.id);
              await fetchMatches(user?.id);
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de retirer ce joueur');
            }
          },
        },
      ]
    );
  };

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
        ) : !attendanceOpen ? (
          <>
            <Text style={styles.lockedMessage}>{getAttendanceLockMessage(match.status)}</Text>
            <Text style={styles.lockedStatus}>
              Ta réponse : {ATTENDANCE_LABELS[myAttendance]}
            </Text>
            <ProgressBar
              progress={presentUsers.length / match.maxPlayers}
              label={`${presentUsers.length}/${match.maxPlayers} confirmés`}
              showLabel
            />
          </>
        ) : (
          <>
            <AttendanceActions
              currentStatus={myAttendance}
              onStatusChange={handleStatusChange}
              canSetPresent={userCanSetPresent}
            />
            {matchIsFull && myAttendance !== 'present' && !userOnWaitlist && (
              <Text style={styles.fullHint}>
                Ce match est complet. Rejoins la liste d'attente : si une place se libère, tout le monde est prévenu et c'est le premier à confirmer qui l'obtient.
              </Text>
            )}
            {userOnWaitlist && waitlistPosition != null && (
              <View style={styles.waitlistBanner}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.waitlistText}>
                  En liste d'attente (inscrit n°{waitlistPosition}) — réagis vite quand tu reçois la notif
                </Text>
              </View>
            )}
            {userCanJoinWaitlist && (
              <Button
                title="Rejoindre la liste d'attente"
                onPress={handleJoinWaitlist}
                icon="hourglass-outline"
                fullWidth
                variant="outline"
                style={styles.waitlistBtn}
              />
            )}
            {userOnWaitlist && (
              <Button
                title="Quitter la liste d'attente"
                onPress={handleLeaveWaitlist}
                variant="ghost"
                fullWidth
                size="sm"
              />
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
        {canManageRoster && (
          <Text style={styles.manageHint}>Appuie sur l'icône pour retirer un joueur de l'effectif.</Text>
        )}
        <AttendanceSection
          title="Présents"
          users={presentUsers}
          statusColor={Colors.success}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Liste d'attente"
          users={getUsersByAttendance(match, 'waitlist', getProfile)}
          statusColor={Colors.primary}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Invitations en attente"
          users={getUsersByAttendance(match, 'pending', getProfile)}
          statusColor={Colors.textMuted}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Peut-être"
          users={maybeUsers}
          statusColor={Colors.warning}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Absents"
          users={absentUsers}
          statusColor={Colors.error}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
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
        {!isCompleted && match.status === 'upcoming' && (
          <Button
            title="Inviter des joueurs"
            onPress={() => router.push({ pathname: '/match/invite', params: { id: match.id } })}
            variant="outline"
            icon="person-add-outline"
            fullWidth
          />
        )}
        {__DEV__ && isOrganizer && match.status === 'upcoming' && (
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
  manageHint: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.md, fontStyle: 'italic' },
  description: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  restricted: { ...Typography.body, color: Colors.textMuted, fontStyle: 'italic' },
  lockedMessage: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
  lockedStatus: { ...Typography.bodyBold, color: Colors.text, marginBottom: Spacing.md },
  fullHint: { ...Typography.caption, color: Colors.warning, marginBottom: Spacing.sm },
  waitlistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  waitlistText: { ...Typography.caption, color: Colors.primary, fontWeight: '600', flex: 1 },
  waitlistBtn: { marginBottom: Spacing.sm },
  actions: { paddingHorizontal: Spacing.xxl, gap: Spacing.md },
});
