import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { completeMatch, PlayerMatchStat } from '@/services/matches';
import { fetchMatchComposition } from '@/services/composition';
import { createNotification } from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { getPresentUsersFromMatch, useProfileStore } from '@/store/profileStore';
import { User } from '@/types';
import { balanceTeams } from '@/utils/teamBalancer';

interface PlayerFormStat extends PlayerMatchStat {
  name: string;
}

function initPlayerStats(players: User[], teamMap: Map<string, 'A' | 'B'>): PlayerFormStat[] {
  return players.map((p) => ({
    userId: p.id,
    name: p.name,
    team: teamMap.get(p.id) ?? 'A',
    goals: 0,
    assists: 0,
    rating: 4,
    mvp: false,
  }));
}

export default function CompleteMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const getProfile = useProfileStore((s) => s.getProfile);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);

  const [teamAScore, setTeamAScore] = useState('0');
  const [teamBScore, setTeamBScore] = useState('0');
  const [playerStats, setPlayerStats] = useState<PlayerFormStat[]>([]);
  const [loading, setLoading] = useState(false);

  const initStats = useCallback(async () => {
    if (!match) return;
    const players = getPresentUsersFromMatch(match, getProfile);
    const teamMap = new Map<string, 'A' | 'B'>();

    try {
      const composition = await fetchMatchComposition(match.id);
      if (composition?.lineups.length) {
        composition.lineups.forEach((l) => teamMap.set(l.userId, l.teamSide));
        const composedIds = new Set(composition.lineups.map((l) => l.userId));
        const composedPlayers = players.filter((p) => composedIds.has(p.id));
        setPlayerStats(initPlayerStats(composedPlayers.length > 0 ? composedPlayers : players, teamMap));
        return;
      }
    } catch {
      // fallback IA
    }

    const balanced = balanceTeams(players);
    balanced.teamA.forEach((p) => teamMap.set(p.user.id, 'A'));
    balanced.teamB.forEach((p) => teamMap.set(p.user.id, 'B'));
    setPlayerStats(initPlayerStats(players, teamMap));
  }, [match, getProfile]);

  useEffect(() => {
    initStats();
  }, [initStats]);

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
        <Text style={styles.muted}>Seul l'organisateur peut terminer ce match.</Text>
      </View>
    );
  }

  if (match.status === 'completed') {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
        <Text style={styles.doneTitle}>Match déjà terminé</Text>
      </View>
    );
  }

  const updatePlayer = (userId: string, patch: Partial<PlayerFormStat>) => {
    setPlayerStats((prev) =>
      prev.map((p) => {
        if (p.userId !== userId) {
          if (patch.mvp) return { ...p, mvp: false };
          return p;
        }
        return { ...p, ...patch };
      })
    );
  };

  const handleSubmit = async () => {
    const scoreA = parseInt(teamAScore, 10);
    const scoreB = parseInt(teamBScore, 10);
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      Alert.alert('Erreur', 'Entre un score valide pour chaque équipe.');
      return;
    }
    if (playerStats.length === 0) {
      Alert.alert('Erreur', 'Aucun joueur confirmé pour enregistrer le résultat.');
      return;
    }

    setLoading(true);
    try {
      await completeMatch(match.id, scoreA, scoreB, playerStats);
      const scoreLabel = `${scoreA} - ${scoreB}`;

      await Promise.all(
        playerStats
          .filter((p) => p.userId !== user?.id)
          .map((p) =>
            createNotification(p.userId, {
              type: 'match_reminder',
              title: 'Match terminé !',
              body: `"${match.title}" — Score final : ${scoreLabel}`,
              data: { matchId: match.id },
            }).catch(() => {})
          )
      );

      await fetchMatches();
      await fetchProfiles();
      await refreshProfile();

      Alert.alert('Match terminé', 'Stats et historique mis à jour pour tous les joueurs.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de terminer le match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Score final</Text>
      <Text style={styles.subtitle}>{match.title}</Text>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBox}>
          <Text style={styles.teamLabel}>Équipe A</Text>
          <TextInput
            style={styles.scoreInput}
            value={teamAScore}
            onChangeText={setTeamAScore}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <Text style={styles.scoreSep}>—</Text>
        <View style={styles.scoreBox}>
          <Text style={styles.teamLabel}>Équipe B</Text>
          <TextInput
            style={styles.scoreInput}
            value={teamBScore}
            onChangeText={setTeamBScore}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Stats joueurs ({playerStats.length})</Text>

      {playerStats.length === 0 ? (
        <Text style={styles.muted}>Aucun joueur confirmé. Marque des présences avant de terminer.</Text>
      ) : (
        playerStats.map((p) => (
          <View key={p.userId} style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <Avatar uri={getProfile(p.userId)?.avatar ?? ''} size={36} name={p.name} />
              <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
              <View style={styles.teamToggle}>
                {(['A', 'B'] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.teamBtn, p.team === t && styles.teamBtnActive]}
                    onPress={() => updatePlayer(p.userId, { team: t })}
                  >
                    <Text style={[styles.teamBtnText, p.team === t && styles.teamBtnTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statField}>
                <Text style={styles.statLabel}>Buts</Text>
                <TextInput
                  style={styles.statInput}
                  value={String(p.goals)}
                  onChangeText={(v) => updatePlayer(p.userId, { goals: Math.max(0, parseInt(v, 10) || 0) })}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.statField}>
                <Text style={styles.statLabel}>Passes</Text>
                <TextInput
                  style={styles.statInput}
                  value={String(p.assists)}
                  onChangeText={(v) => updatePlayer(p.userId, { assists: Math.max(0, parseInt(v, 10) || 0) })}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.statField}>
                <Text style={styles.statLabel}>Note /5</Text>
                <TextInput
                  style={styles.statInput}
                  value={String(p.rating)}
                  onChangeText={(v) => {
                    const n = parseFloat(v) || 4;
                    updatePlayer(p.userId, { rating: Math.min(5, Math.max(1, n)) });
                  }}
                  keyboardType="decimal-pad"
                  maxLength={3}
                />
              </View>
              <Pressable
                style={[styles.mvpBtn, p.mvp && styles.mvpBtnActive]}
                onPress={() => updatePlayer(p.userId, { mvp: !p.mvp })}
              >
                <Text style={[styles.mvpText, p.mvp && styles.mvpTextActive]}>MVP</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Button
        title="Valider et terminer le match"
        onPress={handleSubmit}
        loading={loading}
        fullWidth
        size="lg"
        icon="checkmark-circle-outline"
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.xxl },
  muted: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  doneTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.lg },
  title: { ...Typography.h2, color: Colors.text },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.xxl },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.xxxl },
  scoreBox: { alignItems: 'center', flex: 1 },
  teamLabel: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  scoreInput: {
    ...Typography.h1,
    color: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    width: '100%',
    paddingVertical: Spacing.lg,
  },
  scoreSep: { ...Typography.h2, color: Colors.textMuted },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.lg },
  playerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  playerName: { ...Typography.bodyBold, color: Colors.text, flex: 1, fontSize: 14 },
  teamToggle: { flexDirection: 'row', gap: 4 },
  teamBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamBtnActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  teamBtnText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700' },
  teamBtnTextActive: { color: Colors.primary },
  statRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  statField: { flex: 1 },
  statLabel: { ...Typography.small, color: Colors.textMuted, marginBottom: 4 },
  statInput: {
    ...Typography.bodyBold,
    color: Colors.text,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  mvpBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  mvpBtnActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  mvpText: { ...Typography.small, color: Colors.textMuted, fontWeight: '700' },
  mvpTextActive: { color: Colors.background },
  submitBtn: { marginTop: Spacing.xl },
});
