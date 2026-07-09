import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PitchFormationReadOnly } from '@/components/match/PitchFormation';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchMatchComposition, getSlotAssignments } from '@/services/composition';
import { fetchMatchRecap } from '@/services/history';
import { fetchMatchById } from '@/services/matches';
import { useAuthStore } from '@/store/authStore';
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

function PlayerStatRow({ player, isMe }: { player: MatchRecapPlayer; isMe: boolean }) {
  return (
    <View style={[styles.playerRow, isMe && styles.playerRowMe]}>
      <Avatar uri={player.avatarUrl ?? `https://i.pravatar.cc/150?u=${player.userId}`} size={36} />
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={styles.playerName}>{player.name}</Text>
          {player.mvp && <Badge label="MVP" variant="primary" />}
          {isMe && <Text style={styles.meLabel}>Toi</Text>}
        </View>
        <Text style={styles.playerMeta}>
          Équipe {player.team} · {player.result}
        </Text>
      </View>
      <View style={styles.playerStats}>
        <Text style={styles.playerStat}>⚽ {player.goals}</Text>
        <Text style={styles.playerStat}>🅰️ {player.assists}</Text>
        <Text style={styles.playerStat}>⭐ {player.rating}</Text>
      </View>
    </View>
  );
}

export default function MatchRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const getProfile = useProfileStore((s) => s.getProfile);
  const [recap, setRecap] = useState<MatchRecap | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [composition, setComposition] = useState<MatchComposition | null>(null);
  const [loading, setLoading] = useState(true);
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

      {myStats && (
        <View style={styles.myResultCard}>
          <Badge
            label={myStats.result}
            variant={
              myStats.result === 'Victoire' ? 'success' : myStats.result === 'Défaite' ? 'error' : 'warning'
            }
          />
          <Text style={styles.myResultText}>
            {myStats.goals} but{myStats.goals > 1 ? 's' : ''} · {myStats.assists} passe
            {myStats.assists > 1 ? 's' : ''} · ⭐ {myStats.rating} · 🤝 {myStats.fairPlay}/5
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Faits marquants</Text>
        {recap.mvp && (
          <View style={styles.highlightRow}>
            <Text style={styles.highlightIcon}>🏆</Text>
            <Text style={styles.highlightText}>MVP : {recap.mvp.name}</Text>
          </View>
        )}
        <View style={styles.highlightRow}>
          <Text style={styles.highlightIcon}>⚽</Text>
          <Text style={styles.highlightText}>{formatScorers(recap.players)}</Text>
        </View>
        <View style={styles.highlightRow}>
          <Text style={styles.highlightIcon}>🅰️</Text>
          <Text style={styles.highlightText}>{formatAssisters(recap.players)}</Text>
        </View>
      </View>

      {composition && composition.lineups.length > 0 && match && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Composition</Text>
          <Text style={styles.teamTitle}>Équipe A — {composition.formationA}</Text>
          <PitchFormationReadOnly
            slots={formationSlotsA}
            players={playersForSide('A')}
            slotAssignments={getSlotAssignments(composition, 'A')}
            accentColor={Colors.primary}
          />
          <Text style={styles.teamTitle}>Équipe B — {composition.formationB}</Text>
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
        {recap.players.map((player) => (
          <PlayerStatRow key={player.userId} player={player} isMe={player.userId === user?.id} />
        ))}
      </View>
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
  myResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.2)',
  },
  myResultText: { ...Typography.body, color: Colors.text, flex: 1 },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.xs },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  highlightIcon: { fontSize: 16, marginTop: 2 },
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
  playerInfo: { flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  playerName: { ...Typography.bodyBold, color: Colors.text },
  meLabel: { ...Typography.caption, color: Colors.primary },
  playerMeta: { ...Typography.caption, color: Colors.textMuted },
  playerStats: { flexDirection: 'row', gap: Spacing.sm },
  playerStat: { ...Typography.caption, color: Colors.textSecondary },
});
