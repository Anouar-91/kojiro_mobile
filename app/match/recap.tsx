import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PitchFormationReadOnly } from '@/components/match/PitchFormation';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatIcon } from '@/components/ui/StatIcon';
import { ProfileStatIconKey } from '@/constants/profileIcons';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchMatchComposition, getSlotAssignments } from '@/services/composition';
import { fetchMatchRecap } from '@/services/history';
import { fetchMatchById } from '@/services/matches';
import { reopenMatchStats } from '@/services/matchStats';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { Match, MatchRecap, MatchRecapPlayer, User } from '@/types';
import { MatchComposition } from '@/types/lineup';
import { formatShortDate } from '@/utils/formatters';
import {
  buildFormationSlotsFromLayout,
  getDefaultFormation,
  parseFormationLabel,
} from '@/utils/formations';
import { buildGuestUser, isGuestPlayerId, parseGuestPlayerId, uniqueUsersById } from '@/utils/guestAttendees';
import { openUserProfile } from '@/utils/profileNavigation';

function formatScorers(players: MatchRecapPlayer[]): string {
  const scorers = players.filter((p) => p.goals > 0);
  if (scorers.length === 0) return 'Aucun buteur';
  return scorers.map((p) => `${p.name} (${p.goals})`).join(', ');
}

function formatAssisters(players: MatchRecapPlayer[]): string {
  const assisters = players.filter((p) => p.assists > 0);
  if (assisters.length === 0) return 'Aucune passe décisive';
  return assisters.map((p) => `${p.name} (${p.assists})`).join(', ');
}

function RecapStatTile({
  icon,
  label,
  value,
}: {
  icon: ProfileStatIconKey;
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.myStatItem}>
      <StatIcon name={icon} variant="large" slotStyle={styles.myStatIconSlot} />
      <Text style={styles.myStatLabel}>{label}</Text>
      <Text style={styles.myStatValue}>{value}</Text>
    </View>
  );
}

function MyMatchStatsCard({ stats }: { stats: MatchRecapPlayer }) {
  return (
    <View style={styles.myStatsCard}>
      <View style={styles.myStatsHeader}>
        <Text style={styles.myStatsTitle}>Ton match</Text>
        <Badge
          label={stats.result}
          variant={
            stats.result === 'Victoire' ? 'success' : stats.result === 'Défaite' ? 'error' : 'warning'
          }
        />
      </View>

      <View style={styles.myStatsGrid}>
        <RecapStatTile icon="goal" label="Buts" value={stats.goals} />
        <RecapStatTile icon="assist" label="Passes" value={stats.assists} />
        <RecapStatTile icon="defense" label="Défense" value={`${stats.defRating}/5`} />
        <RecapStatTile icon="fairPlay" label="Fair-play" value={`${stats.fairPlay}/5`} />
      </View>

      <View style={styles.myGlobalRating}>
        <View style={styles.myGlobalLeft}>
          <StatIcon name="rating" variant="large" slotStyle={styles.myGlobalIconSlot} />
          <View>
            <Text style={styles.myGlobalLabel}>Note globale</Text>
            <Text style={styles.myGlobalHint}>Calculée automatiquement</Text>
          </View>
        </View>
        <Text style={styles.myGlobalValue}>{Number(stats.rating).toFixed(1)}</Text>
      </View>

      {stats.mvp && (
        <View style={styles.myMvpBanner}>
          <StatIcon name="mvp" variant="compact" slotStyle={styles.myMvpIconSlot} />
          <Text style={styles.myMvpText}>MVP du match</Text>
        </View>
      )}
    </View>
  );
}

function PlayerStatChip({ icon, value }: { icon: ProfileStatIconKey; value: string }) {
  return (
    <View style={styles.playerStatChip}>
      <StatIcon name={icon} variant="compact" />
      <Text style={styles.playerStat}>{value}</Text>
    </View>
  );
}

function PlayerStatRow({
  player,
  isMe,
  onPress,
}: {
  player: MatchRecapPlayer;
  isMe: boolean;
  onPress?: () => void;
}) {
  const isGuest = player.isGuest ?? isGuestPlayerId(player.userId);
  const row = (
    <View style={[styles.playerRow, isMe && styles.playerRowMe]}>
      <Avatar
        uri={isGuest ? '' : (player.avatarUrl ?? `https://i.pravatar.cc/150?u=${player.userId}`)}
        size={36}
        name={player.name}
      />
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={styles.playerName}>{player.name}</Text>
          {player.mvp && <Badge label="MVP" variant="primary" />}
          {isGuest && <Badge label="Invité" variant="warning" />}
          {isMe && <Text style={styles.meLabel}>Toi</Text>}
        </View>
        <Text style={styles.playerMeta}>
          Équipe {player.team} · {player.result}
        </Text>
      </View>
      <View style={styles.playerStats}>
        <PlayerStatChip icon="goal" value={String(player.goals)} />
        <PlayerStatChip icon="assist" value={String(player.assists)} />
        <PlayerStatChip icon="defense" value={String(player.defRating)} />
        <PlayerStatChip icon="fairPlay" value={String(player.fairPlay)} />
        <PlayerStatChip icon="rating" value={String(player.rating)} />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.playerRowPressed}>
        {row}
      </Pressable>
    );
  }

  return row;
}

function HighlightRow({ icon, text }: { icon: ProfileStatIconKey; text: string }) {
  return (
    <View style={styles.highlightRow}>
      <StatIcon name={icon} variant="compact" slotStyle={styles.highlightIconSlot} />
      <Text style={styles.highlightText}>{text}</Text>
    </View>
  );
}

export default function MatchRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const getProfile = useProfileStore((s) => s.getProfile);
  const [recap, setRecap] = useState<MatchRecap | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [composition, setComposition] = useState<MatchComposition | null>(null);
  const [loading, setLoading] = useState(true);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [recapData, matchData, compositionData] = await Promise.all([
        fetchMatchRecap(id),
        fetchMatchById(id),
        fetchMatchComposition(id).catch(() => null),
      ]);
      setRecap(recapData);
      setMatch(matchData);
      setComposition(compositionData);
    } catch (e) {
      setRecap(null);
      setError(e instanceof Error ? e.message : 'Impossible de charger le résumé');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const layoutA = useMemo(() => {
    if (!match) return null;
    return parseFormationLabel(composition?.formationA ?? '') ?? getDefaultFormation(match.format);
  }, [match, composition?.formationA]);

  const layoutB = useMemo(() => {
    if (!match) return null;
    return parseFormationLabel(composition?.formationB ?? '') ?? getDefaultFormation(match.format);
  }, [match, composition?.formationB]);

  const formationSlotsA = useMemo(
    () => (layoutA ? buildFormationSlotsFromLayout(layoutA) : []),
    [layoutA]
  );
  const formationSlotsB = useMemo(
    () => (layoutB ? buildFormationSlotsFromLayout(layoutB) : []),
    [layoutB]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error || !recap) {
    return (
      <View style={styles.centered}>
        <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorTitle}>Résumé indisponible</Text>
        <Text style={styles.errorText}>{error ?? 'Ce match n\'a pas encore de résumé.'}</Text>
      </View>
    );
  }

  const myStats = recap.players.find((p) => p.userId === user?.id);
  const isOrganizer = match?.organizerId === user?.id;

  const handleReopenStats = () => {
    if (!match) return;
    Alert.alert(
      'Rouvrir les stats',
      'Les stats déjà saisies seront conservées pour modification. Les joueurs inscrits recevront une notification et leurs profils seront recalculés temporairement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rouvrir',
          style: 'destructive',
          onPress: async () => {
            setReopening(true);
            try {
              await reopenMatchStats(match.id);
              await fetchMatches(user?.id);
              await fetchProfiles();
              await refreshProfile();
              router.replace({ pathname: '/match/stats', params: { id: match.id } });
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de rouvrir les stats');
            } finally {
              setReopening(false);
            }
          },
        },
      ]
    );
  };

  const playersForSide = (side: 'A' | 'B'): User[] => {
    if (!match || !composition) return [];
    return uniqueUsersById(
      composition.lineups
        .filter((l) => l.teamSide === side)
        .map((l) => {
          if (isGuestPlayerId(l.userId)) {
            const attendeeId = parseGuestPlayerId(l.userId);
            const attendee = match.attendees.find((a) => a.id === attendeeId);
            return attendee ? buildGuestUser(attendee) : null;
          }
          return getProfile(l.userId) ?? null;
        })
        .filter(Boolean) as User[]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{recap.title}</Text>
      <Text style={styles.subtitle}>
        {formatShortDate(recap.date)} · {recap.locationName}
      </Text>

      <View style={styles.scoreCard}>
        <View style={styles.scoreTeam}>
          <Text style={styles.scoreTeamLabel}>Équipe A</Text>
          <Text style={styles.scoreValue}>{recap.teamAScore}</Text>
        </View>
        <Text style={styles.scoreDivider}>-</Text>
        <View style={styles.scoreTeam}>
          <Text style={styles.scoreTeamLabel}>Équipe B</Text>
          <Text style={styles.scoreValue}>{recap.teamBScore}</Text>
        </View>
      </View>

      {myStats && <MyMatchStatsCard stats={myStats} />}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Faits marquants</Text>
        {recap.mvp && (
          <HighlightRow
            icon="mvp"
            text={`MVP : ${recap.mvp.name}${recap.mvp.isGuest ? ' (invité)' : ''}`}
          />
        )}
        <HighlightRow icon="goal" text={formatScorers(recap.players)} />
        <HighlightRow icon="assist" text={formatAssisters(recap.players)} />
      </View>

      {composition && composition.lineups.length > 0 && match && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Composition</Text>
          <Text style={styles.teamTitle}>
            {Object.keys(getSlotAssignments(composition, 'A')).length > 0
              ? `Équipe A — ${composition.formationA}`
              : 'Équipe A'}
          </Text>
          <PitchFormationReadOnly
            slots={formationSlotsA}
            players={playersForSide('A')}
            slotAssignments={getSlotAssignments(composition, 'A')}
            accentColor={Colors.primary}
          />
          <Text style={styles.teamTitle}>
            {Object.keys(getSlotAssignments(composition, 'B')).length > 0
              ? `Équipe B — ${composition.formationB}`
              : 'Équipe B'}
          </Text>
          <PitchFormationReadOnly
            slots={formationSlotsB}
            players={playersForSide('B')}
            slotAssignments={getSlotAssignments(composition, 'B')}
            accentColor={Colors.info}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stats joueurs</Text>
        {recap.players.map((player) => {
          const isMe = player.userId === user?.id;
          const isGuest = player.isGuest ?? isGuestPlayerId(player.userId);
          const canOpenProfile = !isMe && !isGuest;
          return (
            <PlayerStatRow
              key={player.userId}
              player={player}
              isMe={isMe}
              onPress={canOpenProfile ? () => openUserProfile(router, player.userId) : undefined}
            />
          );
        })}
      </View>

      {isOrganizer && (
        <Button
          title="Rouvrir les stats"
          onPress={handleReopenStats}
          loading={reopening}
          icon="refresh-outline"
          fullWidth
          variant="outline"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  errorTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.lg },
  errorText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  title: { ...Typography.h2, color: Colors.text },
  subtitle: { ...Typography.caption, color: Colors.textMuted },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreTeam: { alignItems: 'center', flex: 1 },
  scoreTeamLabel: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.xs },
  scoreValue: { ...Typography.h1, color: Colors.text },
  scoreDivider: { ...Typography.h2, color: Colors.textMuted },
  myStatsCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  myStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myStatsTitle: { ...Typography.bodyBold, color: Colors.text },
  myStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  myStatItem: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  myStatIconSlot: { marginBottom: Spacing.xs },
  myStatLabel: { ...Typography.caption, color: Colors.textMuted, marginBottom: 4 },
  myStatValue: { ...Typography.h3, color: Colors.text, fontWeight: '800' },
  myGlobalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryMuted,
    borderRadius: 10,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.25)',
  },
  myGlobalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  myGlobalIconSlot: { marginBottom: 0 },
  myGlobalLabel: { ...Typography.bodyBold, color: Colors.textSecondary },
  myGlobalHint: { ...Typography.small, color: Colors.textMuted, marginTop: 2 },
  myGlobalValue: { fontSize: 28, fontWeight: '900', color: Colors.primary },
  myMvpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  myMvpIconSlot: { marginBottom: 0 },
  myMvpText: { ...Typography.bodyBold, color: Colors.primary },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.xs },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  highlightIconSlot: { width: 24, marginTop: 2 },
  highlightText: { ...Typography.body, color: Colors.textSecondary, flex: 1 },
  teamTitle: { ...Typography.bodyBold, color: Colors.text, marginTop: Spacing.sm },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playerRowMe: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: Spacing.sm },
  playerRowPressed: { opacity: 0.85 },
  playerInfo: { flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  playerName: { ...Typography.bodyBold, color: Colors.text },
  meLabel: { ...Typography.caption, color: Colors.primary },
  playerMeta: { ...Typography.caption, color: Colors.textMuted },
  playerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 130, justifyContent: 'flex-end' },
  playerStatChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  playerStat: { ...Typography.small, color: Colors.textSecondary },
});