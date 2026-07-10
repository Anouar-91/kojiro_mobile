import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MatchOrganizerSteps } from '@/components/match/MatchOrganizerSteps';
import { AddGuestPlayerModal } from '@/components/match/AddGuestPlayerModal';
import { CaptainPicker } from '@/components/match/CaptainPicker';
import { MatchSubstitutesEditor } from '@/components/match/MatchSubstitutesEditor';
import { DevFillMatchPanel } from '@/components/dev/DevFillMatchPanel';

import { Badge } from '@/components/ui/Badge';
import { AttendanceActions, AttendanceSection } from '@/components/match/PlayerComponents';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useMatchChatUnread } from '@/hooks/useMatchChatUnread';
import { closeMatchRecruitment, reopenMatchRecruitment } from '@/services/matches';
import { assignMatchCaptains, fetchMatchComposition, getTeamPlayerIds } from '@/services/composition';
import { createNotification } from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useMatchStore } from '@/store/matchStore';
import { getUsersByAttendance, useProfileStore } from '@/store/profileStore';
import { AttendanceStatus, Position, User } from '@/types';
import { formatMatchDate, formatPrice, getMatchFormatDescription } from '@/utils/formatters';
import {
  canAddToRoster,
  canChangeToAbsent,
  canChangeToMaybe,
  canChangeToPresent,
  canClaimWaitlistSpot,
  canJoinWaitlist,
  canManageRoster as canOrganizerManageRoster,
  canUseFullAttendanceUI,
  canSetPresent,
  getAttendanceLockMessage,
  getWaitlistPosition,
  isAttendanceFullyLocked,
  isMatchFull,
  isOnWaitlist,
  isRecruitmentClosed,
} from '@/utils/matchAttendance';
import { isGuestPlayerId, parseGuestPlayerId, resolveParticipantUser } from '@/utils/guestAttendees';
import { openUserProfile } from '@/utils/profileNavigation';
import { isRegisteredPresent } from '@/utils/matchStatsRoster';
import {
  canEditComposition,
  getComposeButtonLabel,
  hasCompositionLineups,
  getCompositionRole,
  getRegisteredPresentUserIds,
} from '@/utils/compositionPermissions';
import { MatchComposition } from '@/types/lineup';

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
  const addGuestToMatch = useMatchStore((s) => s.addGuestToMatch);
  const removeAttendeeById = useMatchStore((s) => s.removeAttendeeById);
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const updateSubstitutesPerTeam = useMatchStore((s) => s.updateSubstitutesPerTeam);
  const getProfile = useProfileStore((s) => s.getProfile);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const isFriend = useFriendStore((s) => s.isFriend);
  const [hasComposition, setHasComposition] = useState(false);
  const [composition, setComposition] = useState<MatchComposition | null>(null);
  const [captainAId, setCaptainAId] = useState<string | null>(null);
  const [captainBId, setCaptainBId] = useState<string | null>(null);
  const [savingCaptains, setSavingCaptains] = useState(false);
  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [savingSubstitutes, setSavingSubstitutes] = useState(false);
  const { unreadCount: chatUnreadCount } = useMatchChatUnread(match?.id, user?.id);
  const insets = useSafeAreaInsets();

  const presentAttendeeKey = useMemo(
    () =>
      match?.attendees
        .map((a) => `${a.userId ?? a.id}:${a.status}`)
        .sort()
        .join(',') ?? '',
    [match?.attendees]
  );

  const teamAUsers = useMemo(() => {
    if (!composition || !match) return [];
    return getTeamPlayerIds(composition, 'A')
      .map((id) => resolveParticipantUser(id, match, getProfile))
      .filter((u): u is User => Boolean(u) && !u.isGuest);
  }, [composition, match, getProfile]);

  const teamBUsers = useMemo(() => {
    if (!composition || !match) return [];
    return getTeamPlayerIds(composition, 'B')
      .map((id) => resolveParticipantUser(id, match, getProfile))
      .filter((u): u is User => Boolean(u) && !u.isGuest);
  }, [composition, match, getProfile]);

  useEffect(() => {
    if (!match) return;
    fetchMatchComposition(match.id)
      .then((c) => {
        setComposition(c);
        setHasComposition(Boolean(c?.validatedAt && (c.lineups.length ?? 0) > 0));
        setCaptainAId(c?.captainAId ?? null);
        setCaptainBId(c?.captainBId ?? null);
      })
      .catch(() => {
        setComposition(null);
        setHasComposition(false);
      });
  }, [match?.id, match?.status, presentAttendeeKey]);

  useFocusEffect(
    useCallback(() => {
      if (!match) return;
      fetchMatchComposition(match.id)
        .then((c) => {
          setComposition(c);
          setHasComposition(Boolean(c?.validatedAt && (c.lineups.length ?? 0) > 0));
          setCaptainAId(c?.captainAId ?? null);
          setCaptainBId(c?.captainBId ?? null);
        })
        .catch(() => {
          setComposition(null);
          setHasComposition(false);
        });
    }, [match?.id])
  );

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
  const registeredPresentIds = getRegisteredPresentUserIds(match.attendees);
  const compositionRole = getCompositionRole(
    user?.id,
    match.organizerId,
    composition,
    registeredPresentIds
  );
  const canCompose = canEditComposition(compositionRole, match.status, composition);
  const composeButtonLabel = getComposeButtonLabel(compositionRole, canCompose);
  const hasLineups = hasCompositionLineups(composition);
  const isCompleted = match.status === 'completed';
  const isPendingStats = match.status === 'pending_stats';
  const recruitmentClosed = isRecruitmentClosed(match);
  const attendanceFullyLocked = isAttendanceFullyLocked(match);
  const attendanceOpen = canUseFullAttendanceUI(match);
  const matchIsFull = isMatchFull(match);
  const userCanSetPresent = user ? canSetPresent(match, user.id) : false;
  const userCanChangeToPresent = user ? canChangeToPresent(match, user.id) : false;
  const userCanChangeToMaybe = canChangeToMaybe(match);
  const userCanChangeToAbsent = user ? canChangeToAbsent(match, user.id) : false;
  const userCanClaimWaitlistSpot = user ? canClaimWaitlistSpot(match, user.id) : false;
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
  const canAddPlayers = canAddToRoster(match, isOrganizer);
  const canEditSubstitutes =
    isOrganizer && (match.status === 'upcoming' || match.status === 'live');
  const handleIncreaseSubstitutes = async (nextValue: number) => {
    if (!canEditSubstitutes || nextValue <= match.substitutesPerTeam) return;
    setSavingSubstitutes(true);
    try {
      await updateSubstitutesPerTeam(match.id, nextValue);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de modifier les remplaçants');
    } finally {
      setSavingSubstitutes(false);
    }
  };

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
              if (player.isGuest || isGuestPlayerId(player.id)) {
                const attendeeId = parseGuestPlayerId(player.id);
                if (!attendeeId) return;
                await removeAttendeeById(match.id, attendeeId);
              } else {
                await removeAttendeeByOrganizer(match.id, player.id);
              }
              await fetchMatches(user?.id);
              const updated = await fetchMatchComposition(match.id);
              setComposition(updated);
              setCaptainAId(updated?.captainAId ?? null);
              setCaptainBId(updated?.captainBId ?? null);
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de retirer ce joueur');
            }
          },
        },
      ]
    );
  };

  const handlePlayerPress = useCallback(
    (player: User) => {
      if (player.isGuest || isGuestPlayerId(player.id)) {
        Alert.alert(
          'Joueur invité',
          `${player.name} n'a pas de compte sur l'app. Les joueurs ajoutés manuellement n'ont pas de profil à consulter.`
        );
        return;
      }
      openUserProfile(router, player.id);
    },
    [router]
  );

  const handleAddGuest = async (guestName: string, guestPosition: Position | null) => {
    await addGuestToMatch(match.id, guestName, guestPosition);
    await fetchMatches(user?.id);
  };

  const handleCloseRecruitment = async () => {
    Alert.alert(
      'Fermer le recrutement',
      'Les joueurs ne pourront plus s\'inscrire ni être invités. Ils pourront toujours se désister en cas d\'empêchement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer',
          onPress: async () => {
            try {
              await closeMatchRecruitment(match.id);
              await fetchMatches(user?.id);
              Alert.alert('Recrutement clos', 'L\'effectif est figé. Les joueurs peuvent encore se désister si besoin.');
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de fermer le recrutement');
            }
          },
        },
      ]
    );
  };

  const handleReopenRecruitment = async () => {
    try {
      await reopenMatchRecruitment(match.id);
      await fetchMatches(user?.id);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de rouvrir le recrutement');
    }
  };

  const handleClaimWaitlistSpot = async () => {
    if (!user) return;
    try {
      await updateAttendance(match.id, user.id, 'present');
      Alert.alert('Place confirmée', 'Tu es inscrit comme présent pour ce match.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de confirmer ta place');
    }
  };

  const handleSaveCaptains = async () => {
    if (captainAId && !teamAUsers.some((u) => u.id === captainAId)) {
      Alert.alert('Capitaine invalide', 'Le capitaine A doit être dans l\'équipe A.');
      return;
    }
    if (captainBId && !teamBUsers.some((u) => u.id === captainBId)) {
      Alert.alert('Capitaine invalide', 'Le capitaine B doit être dans l\'équipe B.');
      return;
    }

    setSavingCaptains(true);
    try {
      const prevA = composition?.captainAId ?? null;
      const prevB = composition?.captainBId ?? null;
      await assignMatchCaptains(match.id, captainAId, captainBId);
      const updated = await fetchMatchComposition(match.id);
      setComposition(updated);
      setCaptainAId(updated?.captainAId ?? null);
      setCaptainBId(updated?.captainBId ?? null);

      const toNotify: string[] = [];
      if (captainAId && captainAId !== prevA && captainAId !== user?.id) toNotify.push(captainAId);
      if (captainBId && captainBId !== prevB && captainBId !== user?.id) toNotify.push(captainBId);
      await Promise.all(
        toNotify.map((uid) =>
          createNotification(uid, {
            type: 'team_assigned',
            title: 'Capitaine désigné',
            body: `Tu es capitaine pour "${match.title}". Compose ton équipe depuis le match.`,
            data: { matchId: match.id },
          }).catch(() => {})
        )
      );

      Alert.alert('Capitaines enregistrés', 'Ils peuvent composer leur moitié de terrain.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'enregistrer les capitaines');
    } finally {
      setSavingCaptains(false);
    }
  };

  return (
    <View style={styles.screen}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxxl + 72 + insets.bottom }]}
    >
      {match.imageUrl && (
        <Image source={{ uri: match.imageUrl }} style={styles.hero} contentFit="cover" />
      )}

      <View style={styles.header}>
        <View style={styles.formatRow}>
          <Text style={styles.format}>{getMatchFormatDescription(match.format, match.substitutesPerTeam)}</Text>
          {isFriendsOnly && <Badge label="Entre amis" variant="secondary" />}
          {isCompleted && <Badge label="Terminé" variant="success" />}
          {isPendingStats && <Badge label="Stats en cours" variant="warning" />}
          {match.status === 'live' && <Badge label="En cours" variant="primary" />}
          {recruitmentClosed && <Badge label="Recrutement clos" variant="secondary" />}
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

      {canEditSubstitutes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remplaçants</Text>
          <MatchSubstitutesEditor
            playersPerTeam={match.format}
            substitutesPerTeam={match.substitutesPerTeam}
            saving={savingSubstitutes}
            onIncrease={handleIncreaseSubstitutes}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ma présence</Text>
        {!canJoin && !isOrganizer ? (
          <Text style={styles.restricted}>
            Match réservé aux amis de l'organisateur. Ajoute-le en ami pour participer.
          </Text>
        ) : attendanceFullyLocked ? (
          <>
            <Text style={styles.lockedMessage}>{getAttendanceLockMessage(match)}</Text>
            <Text style={styles.lockedStatus}>
              Ta réponse : {ATTENDANCE_LABELS[myAttendance]}
            </Text>
            <ProgressBar
              progress={presentUsers.length / match.maxPlayers}
              label={`${presentUsers.length}/${match.maxPlayers} confirmés`}
              showLabel
            />
          </>
        ) : !attendanceOpen ? (
          <>
            <Text style={styles.lockedMessage}>{getAttendanceLockMessage(match)}</Text>
            <AttendanceActions
              currentStatus={myAttendance}
              onStatusChange={handleStatusChange}
              canSetPresent={userCanChangeToPresent && userCanSetPresent}
              canSetMaybe={userCanChangeToMaybe}
              canSetAbsent={userCanChangeToAbsent}
            />
            {userCanClaimWaitlistSpot && (
              <Button
                title="Confirmer ma place"
                onPress={handleClaimWaitlistSpot}
                icon="checkmark-circle-outline"
                fullWidth
                style={styles.waitlistBtn}
              />
            )}
            {userOnWaitlist && !userCanClaimWaitlistSpot && waitlistPosition != null && (
              <View style={styles.waitlistBanner}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.waitlistText}>
                  En liste d'attente (inscrit n°{waitlistPosition}) — réagis vite quand tu reçois la notif
                </Text>
              </View>
            )}
            {userOnWaitlist && userCanChangeToAbsent && (
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
        ) : (
          <>
            <AttendanceActions
              currentStatus={myAttendance}
              onStatusChange={handleStatusChange}
              canSetPresent={userCanSetPresent}
              canSetMaybe={userCanChangeToMaybe}
              canSetAbsent={userCanChangeToAbsent}
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
          onPlayerPress={handlePlayerPress}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Liste d'attente"
          users={getUsersByAttendance(match, 'waitlist', getProfile)}
          statusColor={Colors.primary}
          onPlayerPress={handlePlayerPress}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Invitations en attente"
          users={getUsersByAttendance(match, 'pending', getProfile)}
          statusColor={Colors.textMuted}
          onPlayerPress={handlePlayerPress}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Peut-être"
          users={maybeUsers}
          statusColor={Colors.warning}
          onPlayerPress={handlePlayerPress}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
        <AttendanceSection
          title="Absents"
          users={absentUsers}
          statusColor={Colors.error}
          onPlayerPress={handlePlayerPress}
          onRemovePlayer={canManageRoster ? handleRemovePlayer : undefined}
        />
      </View>

      {isOrganizer && !isCompleted && match.status === 'upcoming' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capitaines</Text>
          <CaptainPicker
            teamAUsers={teamAUsers}
            teamBUsers={teamBUsers}
            captainAId={captainAId}
            captainBId={captainBId}
            onCaptainAChange={setCaptainAId}
            onCaptainBChange={setCaptainBId}
            onSave={handleSaveCaptains}
            saving={savingCaptains}
          />
        </View>
      )}

      {match.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{match.description}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {isOrganizer && !isCompleted && match.status === 'upcoming' && !recruitmentClosed && (
          <Button
            title="Fermer le recrutement"
            onPress={handleCloseRecruitment}
            icon="lock-closed-outline"
            fullWidth
            variant="outline"
          />
        )}
        {isOrganizer && !isCompleted && match.status === 'upcoming' && recruitmentClosed && (
          <Button
            title="Rouvrir le recrutement"
            onPress={handleReopenRecruitment}
            icon="lock-open-outline"
            fullWidth
            variant="outline"
          />
        )}
        {isOrganizer && !isCompleted && !isPendingStats && (
          <Button
            title="Ouvrir la saisie des stats"
            onPress={() => router.push({ pathname: '/match/stats', params: { id: match.id } })}
            icon="flag-outline"
            fullWidth
            variant={recruitmentClosed || match.status === 'live' ? 'primary' : 'secondary'}
          />
        )}
        {(isPendingStats && (isOrganizer || isRegisteredPresent(match, user?.id))) && (
          <Button
            title={isOrganizer ? 'Finaliser les stats' : 'Saisir mes stats'}
            onPress={() => router.push({ pathname: '/match/stats', params: { id: match.id } })}
            icon="stats-chart-outline"
            fullWidth
            variant="primary"
          />
        )}
        {isCompleted && (
          <Button
            title="Voir le résumé"
            onPress={() => router.push({ pathname: '/match/recap', params: { id: match.id } })}
            icon="document-text-outline"
            fullWidth
          />
        )}
        {!isCompleted && (
          <>
            {canCompose && (
              <Button
                title={composeButtonLabel}
                onPress={() => router.push({ pathname: '/match/teams', params: { id: match.id } })}
                icon="football-outline"
                fullWidth
              />
            )}
            {(hasLineups || !canCompose) && (
              <Button
                title="Voir la composition"
                onPress={() => router.push({ pathname: '/match/lineup', params: { id: match.id } })}
                icon="eye-outline"
                fullWidth
                variant={canCompose ? 'outline' : 'primary'}
              />
            )}
          </>
        )}
        {!isCompleted && canAddPlayers && (
          <>
            <Button
              title="Inviter des joueurs"
              onPress={() => router.push({ pathname: '/match/invite', params: { id: match.id } })}
              variant="outline"
              icon="person-add-outline"
              fullWidth
            />
            <Button
              title="Ajouter un joueur sans compte"
              onPress={() => setGuestModalVisible(true)}
              variant="outline"
              icon="person-outline"
              fullWidth
            />
          </>
        )}
        <AddGuestPlayerModal
          visible={guestModalVisible}
          onClose={() => setGuestModalVisible(false)}
          onSubmit={handleAddGuest}
          presentCount={presentUsers.length}
          maxPlayers={match.maxPlayers}
        />
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

    {!isCompleted && (
      <Pressable
        style={[styles.chatFab, { bottom: 24 + insets.bottom }]}
        onPress={() => router.push({ pathname: '/match/chat', params: { id: match.id } })}
        accessibilityRole="button"
        accessibilityLabel="Chat du match"
      >
        <Ionicons name="chatbubbles" size={24} color={Colors.background} />
        {chatUnreadCount > 0 && (
          <View style={styles.chatBadge}>
            <Text style={styles.chatBadgeText}>
              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  content: {},
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
  chatFab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.info,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  chatBadgeText: {
    ...Typography.small,
    color: Colors.text,
    fontWeight: '700',
    fontSize: 11,
  },
});
