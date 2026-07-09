import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchMatchComposition } from '@/services/composition';
import {
  buildGoalTotalsStatus,
  captainSaveTeamStats,
  fetchMatchStatsState,
  finalizeMatchStats,
  getMvpCandidates,
  getParticipantKey,
  openMatchStats,
  submitMyMatchStats,
} from '@/services/matchStats';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { getPresentUsersFromMatch, useProfileStore } from '@/store/profileStore';
import { MatchStatsState } from '@/types/matchStats';
import { TeamSide } from '@/types/lineup';
import { isGuestPlayerId } from '@/utils/guestAttendees';
import {
  buildRosterFromComposition,
  buildRosterFromPlayers,
  isRegisteredPresent,
} from '@/utils/matchStatsRoster';

type EditableStat = { goals: number; assists: number };

function StatInputs({
  goals,
  assists,
  onGoalsChange,
  onAssistsChange,
  compact,
}: {
  goals: number;
  assists: number;
  onGoalsChange: (v: number) => void;
  onAssistsChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.statInputs, compact && styles.statInputsCompact]}>
      <View style={styles.statField}>
        <Text style={styles.statLabel}>Buts</Text>
        <TextInput
          style={styles.statInput}
          value={String(goals)}
          onChangeText={(v) => onGoalsChange(Math.max(0, parseInt(v, 10) || 0))}
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
      <View style={styles.statField}>
        <Text style={styles.statLabel}>Passes</Text>
        <TextInput
          style={styles.statInput}
          value={String(assists)}
          onChangeText={(v) => onAssistsChange(Math.max(0, parseInt(v, 10) || 0))}
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
    </View>
  );
}

function GoalTotalsBanner({
  valid,
  messages,
  targetA,
  targetB,
}: {
  valid: boolean;
  messages: string[];
  targetA: number;
  targetB: number;
}) {
  return (
    <View style={[styles.totalsBanner, valid ? styles.totalsBannerOk : styles.totalsBannerWarn]}>
      <View style={styles.totalsBannerHeader}>
        <Ionicons
          name={valid ? 'checkmark-circle' : 'alert-circle'}
          size={22}
          color={valid ? Colors.success : Colors.warning}
        />
        <Text style={[styles.totalsBannerTitle, valid && styles.totalsBannerTitleOk]}>
          {valid ? 'Prêt à finaliser' : 'Répartis les buts avant de valider'}
        </Text>
      </View>
      <Text style={styles.totalsBannerScore}>
        Score du match : {targetA} — {targetB}
      </Text>
      <Text style={styles.totalsBannerHint}>
        {valid
          ? 'La somme des buts par joueur correspond au score.'
          : 'Chaque but du score doit être attribué à un joueur ci-dessous.'}
      </Text>
      {messages.map((line) => {
        const isOk = line.endsWith('— OK');
        return (
          <View key={line} style={styles.totalsLineRow}>
            <Ionicons
              name={isOk ? 'checkmark' : 'close'}
              size={14}
              color={isOk ? Colors.success : Colors.warning}
            />
            <Text style={[styles.totalsLineText, isOk && styles.totalsLineOk]}>{line}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MvpPicker({
  candidates,
  selectedId,
  onSelect,
  getProfile,
}: {
  candidates: MatchStatsState['entries'];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  getProfile: (id: string) => { avatar?: string; name?: string } | undefined;
}) {
  if (candidates.length === 0) {
    return <Text style={styles.muted}>Aucun candidat MVP disponible.</Text>;
  }

  return (
    <View style={styles.mvpList}>
      {candidates.map((c) => {
        if (!c.userId) return null;
        const profile = getProfile(c.userId);
        const active = selectedId === c.userId;
        return (
          <Pressable
            key={c.userId}
            style={[styles.mvpChip, active && styles.mvpChipActive]}
            onPress={() => onSelect(active ? null : c.userId)}
          >
            <Avatar uri={profile?.avatar ?? ''} size={28} name={c.name} />
            <Text style={[styles.mvpChipText, active && styles.mvpChipTextActive]} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MatchStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const getProfile = useProfileStore((s) => s.getProfile);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);

  const [statsState, setStatsState] = useState<MatchStatsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [teamAScore, setTeamAScore] = useState('0');
  const [teamBScore, setTeamBScore] = useState('0');

  const [myGoals, setMyGoals] = useState(0);
  const [myAssists, setMyAssists] = useState(0);
  const [myMvpId, setMyMvpId] = useState<string | null>(null);

  const [captainStats, setCaptainStats] = useState<Record<string, EditableStat>>({});
  const [captainMvpId, setCaptainMvpId] = useState<string | null>(null);

  const [finalStats, setFinalStats] = useState<Record<string, EditableStat>>({});
  const [finalMvpId, setFinalMvpId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const state = await fetchMatchStatsState(id);
      setStatsState(state);

      const myEntry = state.entries.find((e) => e.userId === user?.id);
      if (myEntry) {
        setMyGoals(myEntry.selfGoals ?? myEntry.proposedGoals);
        setMyAssists(myEntry.selfAssists ?? myEntry.proposedAssists);
      }

      const myVote = state.mvpVotes.find((v) => v.voterId === user?.id);
      setMyMvpId(myVote?.votedForId ?? null);
      setCaptainMvpId(myVote?.votedForId ?? null);

      const captainMap: Record<string, EditableStat> = {};
      const finalMap: Record<string, EditableStat> = {};
      state.entries.forEach((e) => {
        const key = getParticipantKey(e);
        captainMap[key] = {
          goals: e.captainGoals ?? e.selfGoals ?? e.proposedGoals,
          assists: e.captainAssists ?? e.selfAssists ?? e.proposedAssists,
        };
        finalMap[key] = { goals: e.proposedGoals, assists: e.proposedAssists };
      });
      setCaptainStats(captainMap);
      setFinalStats(finalMap);

      const topMvp = state.mvpTally[0]?.userId ?? null;
      setFinalMvpId(topMvp);
    } catch (e) {
      if (match?.status !== 'pending_stats') {
        setStatsState(null);
      } else {
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de charger les stats');
      }
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, match?.status]);

  useEffect(() => {
    if (match?.status === 'completed') {
      router.replace({ pathname: '/match/recap', params: { id: id ?? '' } });
      return;
    }
    if (match?.status === 'pending_stats') {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [match?.status, id, loadStats, router]);

  const isOrganizer = user?.id === match?.organizerId;
  const isPresent = isRegisteredPresent(match!, user?.id);
  const captainSide = statsState?.myCaptainSide ?? null;

  const mvpCandidates = useMemo(() => {
    if (!statsState) return [];
    return getMvpCandidates(statsState.entries, statsState.winningSide);
  }, [statsState]);

  const goalTotals = useMemo(() => {
    if (!statsState) {
      return buildGoalTotalsStatus([], 0, 0);
    }
    const entries = Object.entries(finalStats).map(([key, stat]) => {
      const entry = statsState.entries.find((e) => getParticipantKey(e) === key);
      return { teamSide: entry?.teamSide ?? 'A', goals: stat.goals };
    });
    return buildGoalTotalsStatus(
      entries as { teamSide: TeamSide; goals: number }[],
      statsState.teamAScore ?? 0,
      statsState.teamBScore ?? 0
    );
  }, [finalStats, statsState]);

  const handleOpenStats = async () => {
    if (!match || !user) return;
    const scoreA = parseInt(teamAScore, 10);
    const scoreB = parseInt(teamBScore, 10);
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      Alert.alert('Erreur', 'Entre un score valide pour chaque équipe.');
      return;
    }

    const players = getPresentUsersFromMatch(match, getProfile);
    if (players.length === 0) {
      Alert.alert('Erreur', 'Aucun joueur confirmé.');
      return;
    }

    setSaving(true);
    try {
      const composition = await fetchMatchComposition(match.id);
      const roster = composition?.lineups.length
        ? buildRosterFromComposition(composition)
        : buildRosterFromPlayers(players);

      await openMatchStats(match.id, scoreA, scoreB, roster);
      await fetchMatches();
      await loadStats();
      Alert.alert(
        'Saisie ouverte',
        'Les joueurs peuvent renseigner leurs stats. Les capitaines valident leur équipe, puis tu finalises.'
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir la saisie');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMyStats = async () => {
    if (!match) return;
    setSaving(true);
    try {
      await submitMyMatchStats(match.id, myGoals, myAssists, myMvpId);
      await loadStats();
      Alert.alert('Enregistré', 'Tes stats ont été envoyées.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'enregistrer');
    } finally {
      setSaving(false);
    }
  };

  const handleCaptainSave = async (side: TeamSide) => {
    if (!match || !statsState) return;
    const teamEntries = statsState.entries.filter((e) => e.teamSide === side);
    const players = teamEntries.map((e) => {
      const key = getParticipantKey(e);
      const stat = captainStats[key] ?? { goals: 0, assists: 0 };
      return {
        userId: e.userId ?? undefined,
        attendeeId: e.attendeeId ?? undefined,
        goals: stat.goals,
        assists: stat.assists,
      };
    });

    setSaving(true);
    try {
      await captainSaveTeamStats(match.id, side, players, captainMvpId);
      await loadStats();
      Alert.alert('Équipe validée', `Les stats de l'équipe ${side} ont été enregistrées.`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'enregistrer');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!match || !statsState) return;
    if (!goalTotals.valid) {
      Alert.alert(
        'Totaux incorrects',
        `Les buts saisis (A: ${goalTotals.teamA}, B: ${goalTotals.teamB}) ne correspondent pas au score (${goalTotals.targetA} - ${goalTotals.targetB}). Corrige avant de finaliser.`
      );
      return;
    }

    setSaving(true);
    try {
      const playerStats = statsState.entries
        .filter((e) => e.userId && !e.isGuest)
        .map((e) => {
          const key = getParticipantKey(e);
          const stat = finalStats[key] ?? { goals: 0, assists: 0 };
          return {
            userId: e.userId!,
            team: e.teamSide,
            goals: stat.goals,
            assists: stat.assists,
          };
        });

      await finalizeMatchStats(match.id, playerStats, finalMvpId);
      await fetchMatches();
      await fetchProfiles();
      await refreshProfile();
      Alert.alert('Match terminé', 'Stats et résumé mis à jour.', [
        { text: 'Voir le résumé', onPress: () => router.replace({ pathname: '/match/recap', params: { id: match.id } }) },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de finaliser');
    } finally {
      setSaving(false);
    }
  };

  if (!match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Match introuvable</Text>
      </View>
    );
  }

  if (loading && match.status === 'pending_stats') {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Chargement…</Text>
      </View>
    );
  }

  if (match.status !== 'pending_stats') {
    if (!isOrganizer) {
      return (
        <View style={styles.centered}>
          <Text style={styles.muted}>L'organisateur n'a pas encore ouvert la saisie des stats.</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ouvrir la saisie des stats</Text>
        <Text style={styles.subtitle}>{match.title}</Text>
        <Text style={styles.hint}>
          Indique le score final. Chaque joueur saisira ses stats, les capitaines valideront leur équipe, puis tu finalises.
        </Text>

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

        <Button
          title="Ouvrir la saisie"
          onPress={handleOpenStats}
          loading={saving}
          fullWidth
          size="lg"
          icon="flag-outline"
        />
      </ScrollView>
    );
  }

  if (!statsState) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Impossible de charger les stats.</Text>
      </View>
    );
  }

  const myEntry = statsState.entries.find((e) => e.userId === user?.id);
  const captainTeamEntries = captainSide
    ? statsState.entries.filter((e) => e.teamSide === captainSide)
    : [];
  const teamAValidated = statsState.teamValidations.some((v) => v.teamSide === 'A');
  const teamBValidated = statsState.teamValidations.some((v) => v.teamSide === 'B');

  const updateCaptainStat = (key: string, patch: Partial<EditableStat>) => {
    setCaptainStats((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const updateFinalStat = (key: string, patch: Partial<EditableStat>) => {
    setFinalStats((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Stats du match</Text>
      <Text style={styles.subtitle}>{match.title}</Text>

      <View style={styles.scoreBanner}>
        <Text style={styles.scoreBannerText}>
          Score : {statsState.teamAScore} — {statsState.teamBScore}
          {statsState.winningSide === 'draw' ? ' (nul)' : ` · Équipe ${statsState.winningSide} gagnante`}
        </Text>
      </View>

      {isPresent && myEntry && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes stats</Text>
          <Text style={styles.hint}>
            Indique tes buts et passes, puis vote pour le MVP.
            {isOrganizer ? ' Cette section n\'enregistre que tes stats — la finalisation du match se fait plus bas.' : ''}
          </Text>
          <StatInputs
            goals={myGoals}
            assists={myAssists}
            onGoalsChange={setMyGoals}
            onAssistsChange={setMyAssists}
          />
          <Text style={styles.mvpLabel}>Vote MVP</Text>
          <MvpPicker
            candidates={mvpCandidates}
            selectedId={myMvpId}
            onSelect={setMyMvpId}
            getProfile={getProfile}
          />
          {myEntry.selfSubmittedAt && (
            <Text style={styles.submittedHint}>Envoyé · tu peux modifier et renvoyer</Text>
          )}
          <Button title="Enregistrer mes stats" onPress={handleSubmitMyStats} loading={saving} fullWidth variant="outline" />
        </View>
      )}

      {captainSide && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capitaine — équipe {captainSide}</Text>
          <Text style={styles.hint}>
            Vérifie les stats de ton équipe, corrige si besoin, puis valide.
          </Text>
          {captainTeamEntries.map((e) => {
            const key = getParticipantKey(e);
            const stat = captainStats[key] ?? { goals: 0, assists: 0 };
            const selfHint =
              e.selfSubmittedAt != null
                ? `Auto-déclaré : ${e.selfGoals ?? 0} but(s), ${e.selfAssists ?? 0} passe(s)`
                : 'Pas encore auto-déclaré';
            return (
              <View key={key} style={styles.playerCard}>
                <View style={styles.playerHeader}>
                  <Avatar
                    uri={e.userId && !isGuestPlayerId(e.userId) ? (getProfile(e.userId)?.avatar ?? '') : ''}
                    size={32}
                    name={e.name}
                  />
                  <View style={styles.playerNameWrap}>
                    <Text style={styles.playerName}>{e.name}</Text>
                    <Text style={styles.selfHint}>{selfHint}</Text>
                  </View>
                </View>
                <StatInputs
                  goals={stat.goals}
                  assists={stat.assists}
                  onGoalsChange={(g) => updateCaptainStat(key, { goals: g })}
                  onAssistsChange={(a) => updateCaptainStat(key, { assists: a })}
                  compact
                />
              </View>
            );
          })}
          <Text style={styles.mvpLabel}>Vote MVP</Text>
          <MvpPicker
            candidates={mvpCandidates}
            selectedId={captainMvpId}
            onSelect={setCaptainMvpId}
            getProfile={getProfile}
          />
          <Button
            title={`Valider l'équipe ${captainSide}`}
            onPress={() => handleCaptainSave(captainSide)}
            loading={saving}
            fullWidth
            icon="checkmark-circle-outline"
          />
          {captainSide === 'A' && teamAValidated && (
            <Text style={styles.validatedHint}>Équipe A validée</Text>
          )}
          {captainSide === 'B' && teamBValidated && (
            <Text style={styles.validatedHint}>Équipe B validée</Text>
          )}
        </View>
      )}

      {isOrganizer && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Finalisation (organisateur)</Text>
          <Text style={styles.hint}>
            Répartis les buts de chaque joueur pour qu'ils correspondent au score du match, puis valide.
          </Text>

          <GoalTotalsBanner
            valid={goalTotals.valid}
            messages={goalTotals.messages}
            targetA={goalTotals.targetA}
            targetB={goalTotals.targetB}
          />

          <View style={styles.validationRow}>
            <Text style={styles.validationChip}>Équipe A {teamAValidated ? '✓' : '…'}</Text>
            <Text style={styles.validationChip}>Équipe B {teamBValidated ? '✓' : '…'}</Text>
          </View>

          {statsState.entries.map((e) => {
            const key = getParticipantKey(e);
            const stat = finalStats[key] ?? { goals: 0, assists: 0 };
            return (
              <View key={key} style={styles.playerCard}>
                <View style={styles.playerHeader}>
                  <Text style={styles.teamBadge}>{e.teamSide}</Text>
                  <Text style={styles.playerName}>{e.name}</Text>
                  {e.isGuest && <Text style={styles.guestTag}>Invité</Text>}
                </View>
                {e.userId && !e.isGuest ? (
                  <StatInputs
                    goals={stat.goals}
                    assists={stat.assists}
                    onGoalsChange={(g) => updateFinalStat(key, { goals: g })}
                    onAssistsChange={(a) => updateFinalStat(key, { assists: a })}
                    compact
                  />
                ) : (
                  <Text style={styles.muted}>Stats invité (non comptabilisées au profil)</Text>
                )}
              </View>
            );
          })}

          <Text style={styles.mvpLabel}>MVP final</Text>
          {statsState.mvpTally.length > 0 && (
            <Text style={styles.hint}>
              Votes : {statsState.mvpTally.map((t) => {
                const name = statsState.entries.find((e) => e.userId === t.userId)?.name ?? '?';
                return `${name} (${t.votes})`;
              }).join(', ')}
            </Text>
          )}
          <MvpPicker
            candidates={mvpCandidates}
            selectedId={finalMvpId}
            onSelect={setFinalMvpId}
            getProfile={getProfile}
          />

          <Button
            title="Valider et terminer le match"
            onPress={handleFinalize}
            loading={saving}
            fullWidth
            size="lg"
            icon="checkmark-circle-outline"
            disabled={!goalTotals.valid}
          />
          {!goalTotals.valid && (
            <Text style={styles.blockedHint}>
              Le bouton reste désactivé tant que les buts saisis ne correspondent pas au score ({goalTotals.targetA} — {goalTotals.targetB}).
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.xxl },
  muted: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  title: { ...Typography.h2, color: Colors.text },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.md },
  hint: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.lg },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.xxl },
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
  scoreBanner: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  scoreBannerText: { ...Typography.bodyBold, color: Colors.primary, textAlign: 'center' },
  section: {
    marginBottom: Spacing.xxl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.sm },
  statInputs: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  statInputsCompact: { marginBottom: 0 },
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
  mvpLabel: { ...Typography.caption, color: Colors.text, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.sm },
  mvpList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  mvpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    maxWidth: '48%',
  },
  mvpChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  mvpChipText: { ...Typography.small, color: Colors.textMuted, flexShrink: 1 },
  mvpChipTextActive: { color: Colors.primary, fontWeight: '700' },
  submittedHint: { ...Typography.caption, color: Colors.success, marginBottom: Spacing.md },
  validatedHint: { ...Typography.caption, color: Colors.success, marginTop: Spacing.sm, textAlign: 'center' },
  playerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  playerNameWrap: { flex: 1 },
  playerName: { ...Typography.bodyBold, color: Colors.text, flex: 1 },
  selfHint: { ...Typography.small, color: Colors.textMuted },
  teamBadge: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  guestTag: { ...Typography.small, color: Colors.textMuted },
  totalsBanner: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  totalsBannerWarn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.warning,
  },
  totalsBannerOk: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.success,
  },
  totalsBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  totalsBannerTitle: { ...Typography.bodyBold, color: Colors.warning, flex: 1 },
  totalsBannerTitleOk: { color: Colors.success },
  totalsBannerScore: { ...Typography.bodyBold, color: Colors.text, marginBottom: Spacing.xs },
  totalsBannerHint: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.md },
  totalsLineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.xs },
  totalsLineText: { ...Typography.caption, color: Colors.warning, flex: 1 },
  totalsLineOk: { color: Colors.success },
  blockedHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  validationRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  validationChip: {
    ...Typography.caption,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
});
