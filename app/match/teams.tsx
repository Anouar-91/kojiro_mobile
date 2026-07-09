import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormationPicker } from '@/components/match/FormationPicker';
import { PitchFormation } from '@/components/match/PitchFormation';
import { PlayerRow } from '@/components/match/PlayerComponents';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import {
  buildLineupsFromState,
  fetchMatchComposition,
  normalizeTeamRosters,
  saveMatchComposition,
} from '@/services/composition';
import { createNotification } from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { getPresentUsersFromMatch, useProfileStore } from '@/store/profileStore';
import { User } from '@/types';
import { TeamSide } from '@/types/lineup';
import {
  autoFillLineup,
  buildFormationSlotsFromLayout,
  formatFormationLabel,
  FormationLayout,
  getDefaultFormation,
  isValidFormation,
  parseFormationLabel,
  pruneSlotAssignments,
} from '@/utils/formations';
import { getAttendeeParticipantId, resolveParticipantUser } from '@/utils/guestAttendees';
import { balanceTeams } from '@/utils/teamBalancer';

type Step = 'teams' | 'formation-a' | 'formation-b' | 'review';

function autoToSlotAssignments(auto: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  Object.entries(auto).forEach(([userId, slotId]) => {
    if (slotId !== 'bench') result[slotId] = userId;
  });
  return result;
}

function addPlayerToSlots(
  existing: Record<string, string>,
  userId: string,
  slots: { id: string }[]
): Record<string, string> {
  const next = { ...existing };
  Object.keys(next).forEach((k) => {
    if (next[k] === userId) delete next[k];
  });
  for (const slot of slots) {
    if (!next[slot.id]) {
      next[slot.id] = userId;
      break;
    }
  }
  return next;
}

function syncRostersWithPresentPlayers(
  teamAIds: string[],
  teamBIds: string[],
  presentIds: string[]
): { teamAIds: string[]; teamBIds: string[]; changed: boolean } {
  const presentSet = new Set(presentIds);
  const filteredA = teamAIds.filter((id) => presentSet.has(id));
  const filteredB = teamBIds.filter((id) => presentSet.has(id));
  const assigned = new Set([...filteredA, ...filteredB]);
  const missing = presentIds.filter((id) => !assigned.has(id));

  if (
    missing.length === 0 &&
    filteredA.length === teamAIds.length &&
    filteredB.length === teamBIds.length
  ) {
    return { teamAIds, teamBIds, changed: false };
  }

  const nextA = [...filteredA];
  const nextB = [...filteredB];
  for (const userId of missing) {
    if (nextA.length <= nextB.length) nextA.push(userId);
    else nextB.push(userId);
  }
  return { teamAIds: nextA, teamBIds: nextB, changed: true };
}

function removeAbsentFromSlots(
  slots: Record<string, string>,
  presentSet: Set<string>
): Record<string, string> {
  let changed = false;
  const next = { ...slots };
  for (const [slotId, userId] of Object.entries(next)) {
    if (!presentSet.has(userId)) {
      delete next[slotId];
      changed = true;
    }
  }
  return changed ? next : slots;
}

export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const getProfile = useProfileStore((s) => s.getProfile);

  const defaultLayout = useMemo(
    () => (match ? getDefaultFormation(match.format) : { def: 2, mid: 3, fwd: 2 }),
    [match]
  );

  const [step, setStep] = useState<Step>('teams');
  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);
  const [formationLayoutA, setFormationLayoutA] = useState<FormationLayout>(defaultLayout);
  const [formationLayoutB, setFormationLayoutB] = useState<FormationLayout>(defaultLayout);
  const [slotsA, setSlotsA] = useState<Record<string, string>>({});
  const [slotsB, setSlotsB] = useState<Record<string, string>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const rostersRef = useRef({ teamAIds, teamBIds });
  rostersRef.current = { teamAIds, teamBIds };

  const presentIdsKey = useMemo(
    () =>
      match
        ? match.attendees
            .filter((a) => a.status === 'present')
            .map((a) => getAttendeeParticipantId(a))
            .sort()
            .join(',')
        : '',
    [match?.attendees]
  );

  const formationSlotsA = useMemo(
    () => buildFormationSlotsFromLayout(formationLayoutA),
    [formationLayoutA]
  );
  const formationSlotsB = useMemo(
    () => buildFormationSlotsFromLayout(formationLayoutB),
    [formationLayoutB]
  );
  const labelA = formatFormationLabel(formationLayoutA);
  const labelB = formatFormationLabel(formationLayoutB);

  const initFromPlayers = useCallback(
    (players: User[], layoutA: FormationLayout, layoutB: FormationLayout) => {
      const balanced = balanceTeams(players);
      const aIds = balanced.teamA.map((p) => p.user.id);
      const bIds = balanced.teamB.map((p) => p.user.id);
      const slotsABuilt = buildFormationSlotsFromLayout(layoutA);
      const slotsBBuilt = buildFormationSlotsFromLayout(layoutB);
      setTeamAIds(aIds);
      setTeamBIds(bIds);
      setFormationLayoutA(layoutA);
      setFormationLayoutB(layoutB);
      setSlotsA(autoToSlotAssignments(autoFillLineup(aIds, slotsABuilt)));
      setSlotsB(autoToSlotAssignments(autoFillLineup(bIds, slotsBBuilt)));
    },
    []
  );

  useEffect(() => {
    if (!match) return;
    let active = true;

    (async () => {
      setLoading(true);
      try {
        const composition = await fetchMatchComposition(match.id);
        const players = getPresentUsersFromMatch(match, getProfile);
        const def = getDefaultFormation(match.format);

        if (composition && composition.lineups.length > 0) {
          const aIds = [...new Set(composition.lineups.filter((l) => l.teamSide === 'A').map((l) => l.userId))];
          const bIds = [
            ...new Set(
              composition.lineups.filter((l) => l.teamSide === 'B').map((l) => l.userId)
            ),
          ].filter((id) => !aIds.includes(id));
          const layoutA = parseFormationLabel(composition.formationA) ?? def;
          const layoutB = parseFormationLabel(composition.formationB) ?? def;
          setTeamAIds(aIds);
          setTeamBIds(bIds);
          setFormationLayoutA(layoutA);
          setFormationLayoutB(layoutB);

          const mapSide = (side: TeamSide) => {
            const m: Record<string, string> = {};
            composition.lineups
              .filter((l) => l.teamSide === side && l.slotId)
              .forEach((l) => {
                m[l.slotId!] = l.userId;
              });
            return m;
          };
          setSlotsA(mapSide('A'));
          setSlotsB(mapSide('B'));
        } else if (players.length >= 2) {
          initFromPlayers(players, def, def);
        } else {
          setFormationLayoutA(def);
          setFormationLayoutB(def);
        }
      } catch {
        const players = getPresentUsersFromMatch(match, getProfile);
        const def = getDefaultFormation(match.format);
        if (players.length >= 2) initFromPlayers(players, def, def);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [match?.id, getProfile, initFromPlayers]);

  useEffect(() => {
    if (loading || !match || !presentIdsKey) return;

    const presentIds = presentIdsKey.split(',');
    const presentSet = new Set(presentIds);
    const { teamAIds: prevA, teamBIds: prevB } = rostersRef.current;
    const synced = syncRostersWithPresentPlayers(prevA, prevB, presentIds);

    if (synced.changed) {
      setTeamAIds(synced.teamAIds);
      setTeamBIds(synced.teamBIds);
    }

    setSlotsA((prev) => removeAbsentFromSlots(prev, presentSet));
    setSlotsB((prev) => removeAbsentFromSlots(prev, presentSet));
  }, [presentIdsKey, loading, match]);

  const handleFormationChange = (side: TeamSide, layout: FormationLayout) => {
    if (!match || !isValidFormation(layout, match.format)) return;
    const newSlots = buildFormationSlotsFromLayout(layout);
    const validIds = new Set(newSlots.map((s) => s.id));
    if (side === 'A') {
      setFormationLayoutA(layout);
      setSlotsA((prev) => pruneSlotAssignments(prev, validIds));
    } else {
      setFormationLayoutB(layout);
      setSlotsB((prev) => pruneSlotAssignments(prev, validIds));
    }
  };

  if (!match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Match introuvable</Text>
      </View>
    );
  }

  const isOrganizer = user?.id === match.organizerId;
  if (!isOrganizer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Seul l'organisateur peut composer les équipes.</Text>
        <Button
          title="Voir la composition"
          onPress={() => router.push({ pathname: '/match/lineup', params: { id: match.id } })}
          variant="outline"
          style={{ marginTop: Spacing.lg }}
        />
      </View>
    );
  }

  if (match.status === 'completed') {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Match terminé.</Text>
        <Button
          title="Voir la composition"
          onPress={() => router.push({ pathname: '/match/lineup', params: { id: match.id } })}
          fullWidth
        />
      </View>
    );
  }

  const resolveUser = (id: string) => resolveParticipantUser(id, match, getProfile);

  const playersA = teamAIds.map(resolveUser).filter(Boolean) as User[];
  const playersB = teamBIds.map(resolveUser).filter(Boolean) as User[];
  const allPresent = getPresentUsersFromMatch(match, getProfile);

  const moveToTeam = (userId: string, target: TeamSide) => {
    setTeamAIds((prev) => {
      const without = prev.filter((uid) => uid !== userId);
      return target === 'A' ? [...without, userId] : without;
    });
    setTeamBIds((prev) => {
      const without = prev.filter((uid) => uid !== userId);
      return target === 'B' ? [...without, userId] : without;
    });
    setSlotsA((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === userId) delete next[k];
      });
      return target === 'A' ? addPlayerToSlots(next, userId, formationSlotsA) : next;
    });
    setSlotsB((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === userId) delete next[k];
      });
      return target === 'B' ? addPlayerToSlots(next, userId, formationSlotsB) : next;
    });
  };

  const handleAssignSlot = (side: TeamSide, slotId: string) => {
    if (!selectedPlayerId) return;
    const setter = side === 'A' ? setSlotsA : setSlotsB;
    setter((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === selectedPlayerId) delete next[k];
      });
      next[slotId] = selectedPlayerId;
      return next;
    });
    setSelectedPlayerId(null);
  };

  const handleClearSlot = (side: TeamSide, slotId: string) => {
    const setter = side === 'A' ? setSlotsA : setSlotsB;
    setter((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  };

  const handleRebalance = () => {
    initFromPlayers(allPresent, formationLayoutA, formationLayoutB);
  };

  const handleAutoPlace = (side: TeamSide) => {
    const ids = side === 'A' ? teamAIds : teamBIds;
    const slots = side === 'A' ? formationSlotsA : formationSlotsB;
    const setter = side === 'A' ? setSlotsA : setSlotsB;
    setter(autoToSlotAssignments(autoFillLineup(ids, slots)));
  };

  const handleSave = async () => {
    if (!isValidFormation(formationLayoutA, match.format) || !isValidFormation(formationLayoutB, match.format)) {
      Alert.alert('Formation invalide', 'Vérifie que DEF + MIL + ATT = joueurs de champ pour chaque équipe.');
      return;
    }
    setSaving(true);
    try {
      const { teamAIds: rosterA, teamBIds: rosterB } = normalizeTeamRosters(teamAIds, teamBIds);
      const lineups = buildLineupsFromState(
        rosterA,
        rosterB,
        slotsA,
        slotsB,
        formationSlotsA,
        formationSlotsB
      );
      await saveMatchComposition(match.id, labelA, labelB, lineups);

      const allIds = [...rosterA, ...rosterB];
      await Promise.all(
        allIds
          .filter((uid) => uid !== user?.id)
          .map((uid) =>
            createNotification(uid, {
              type: 'team_assigned',
              title: 'Composition publiée',
              body: `L'organisateur a publié les équipes pour "${match.title}".`,
              data: { matchId: match.id },
            }).catch(() => {})
          )
      );

      await fetchMatches(user?.id);
      Alert.alert('Composition enregistrée', 'Les joueurs peuvent consulter la formation.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: 'teams', label: 'Équipes' },
    { key: 'formation-a', label: 'Form. A' },
    { key: 'formation-b', label: 'Form. B' },
    { key: 'review', label: 'Valider' },
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.stepper}>
        {steps.map((s, i) => (
          <Pressable key={s.key} style={styles.stepItem} onPress={() => setStep(s.key)}>
            <View style={[styles.stepDot, step === s.key && styles.stepDotActive]}>
              <Text style={[styles.stepNum, step === s.key && styles.stepNumActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, step === s.key && styles.stepLabelActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {step === 'teams' && (
        <>
          <View style={styles.aiHeader}>
            <Text style={styles.aiIcon}>🤖</Text>
            <View style={styles.aiInfo}>
              <Text style={styles.aiTitle}>Étape 1 — Répartir les équipes</Text>
              <Text style={styles.aiDesc}>
                Déplace les joueurs entre A et B. Tu choisiras la formation (2-3-1, 3-2-1…) à l'étape suivante.
              </Text>
            </View>
          </View>

          {allPresent.length < 2 ? (
            <Text style={styles.muted}>Il faut au moins 2 joueurs confirmés présents.</Text>
          ) : (
            <View style={styles.teamsSplit}>
              <TeamList
                title="Équipe A"
                color={Colors.primary}
                userIds={teamAIds}
                resolveUser={resolveUser}
                onMove={(uid) => moveToTeam(uid, 'B')}
                moveIcon="arrow-forward"
              />
              <TeamList
                title="Équipe B"
                color={Colors.info}
                userIds={teamBIds}
                resolveUser={resolveUser}
                onMove={(uid) => moveToTeam(uid, 'A')}
                moveIcon="arrow-back"
              />
            </View>
          )}

          <Button title="Rééquilibrer avec l'IA" onPress={handleRebalance} variant="outline" icon="shuffle-outline" fullWidth />
          <Button title="Formation équipe A" onPress={() => setStep('formation-a')} fullWidth disabled={teamAIds.length === 0} />
        </>
      )}

      {step === 'formation-a' && (
        <>
          <Text style={styles.stepTitle}>Étape 2 — Équipe A</Text>
          <FormationPicker
            playersPerTeam={match.format}
            value={formationLayoutA}
            onChange={(layout) => handleFormationChange('A', layout)}
            accentColor={Colors.primary}
          />
          <Text style={styles.stepHint}>Touche un joueur au banc, puis une position sur le terrain.</Text>
          <Button title="Placer automatiquement" onPress={() => handleAutoPlace('A')} variant="outline" size="sm" />
          <PitchFormation
            slots={formationSlotsA}
            players={playersA}
            slotAssignments={slotsA}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={setSelectedPlayerId}
            onAssignToSlot={(slotId) => handleAssignSlot('A', slotId)}
            onClearSlot={(slotId) => handleClearSlot('A', slotId)}
            accentColor={Colors.primary}
          />
          <View style={styles.navRow}>
            <Button title="Retour" onPress={() => setStep('teams')} variant="ghost" />
            <Button title="Équipe B" onPress={() => setStep('formation-b')} />
          </View>
        </>
      )}

      {step === 'formation-b' && (
        <>
          <Text style={styles.stepTitle}>Étape 3 — Équipe B</Text>
          <FormationPicker
            playersPerTeam={match.format}
            value={formationLayoutB}
            onChange={(layout) => handleFormationChange('B', layout)}
            accentColor={Colors.info}
          />
          <Text style={styles.stepHint}>Touche un joueur au banc, puis une position sur le terrain.</Text>
          <Button title="Placer automatiquement" onPress={() => handleAutoPlace('B')} variant="outline" size="sm" />
          <PitchFormation
            slots={formationSlotsB}
            players={playersB}
            slotAssignments={slotsB}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={setSelectedPlayerId}
            onAssignToSlot={(slotId) => handleAssignSlot('B', slotId)}
            onClearSlot={(slotId) => handleClearSlot('B', slotId)}
            accentColor={Colors.info}
          />
          <View style={styles.navRow}>
            <Button title="Équipe A" onPress={() => setStep('formation-a')} variant="ghost" />
            <Button title="Récapitulatif" onPress={() => setStep('review')} />
          </View>
        </>
      )}

      {step === 'review' && (
        <>
          <Text style={styles.stepTitle}>Étape 4 — Valider la composition</Text>
          <Text style={styles.stepHint}>
            A ({labelA}) : {teamAIds.length} joueurs · B ({labelB}) : {teamBIds.length} joueurs
          </Text>
          <Text style={styles.reviewSection}>Équipe A — {labelA}</Text>
          <PitchFormation
            slots={formationSlotsA}
            players={playersA}
            slotAssignments={slotsA}
            readOnly
            accentColor={Colors.primary}
          />
          <Text style={styles.reviewSection}>Équipe B — {labelB}</Text>
          <PitchFormation
            slots={formationSlotsB}
            players={playersB}
            slotAssignments={slotsB}
            readOnly
            accentColor={Colors.info}
          />
          <Button
            title="Publier la composition"
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
            icon="checkmark-circle-outline"
          />
        </>
      )}
    </ScrollView>
  );
}

function TeamList({
  title,
  color,
  userIds,
  resolveUser,
  onMove,
  moveIcon,
}: {
  title: string;
  color: string;
  userIds: string[];
  resolveUser: (id: string) => User | null;
  onMove: (userId: string) => void;
  moveIcon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.teamCol, { borderColor: `${color}50` }]}>
      <Text style={[styles.teamColTitle, { color }]}>{title}</Text>
      {userIds.map((uid) => {
        const p = resolveUser(uid);
        if (!p) return null;
        return (
          <View key={uid} style={styles.teamRow}>
            <View style={styles.teamRowPlayer}>
              <PlayerRow user={p} showSkill />
            </View>
            <Pressable onPress={() => onMove(uid)} style={styles.moveBtn}>
              <Ionicons name={moveIcon} size={18} color={color} />
            </Pressable>
          </View>
        );
      })}
      {userIds.length === 0 && <Text style={styles.muted}>Aucun joueur</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, backgroundColor: Colors.background },
  muted: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  stepNum: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700' },
  stepNumActive: { color: Colors.primary },
  stepLabel: { ...Typography.small, color: Colors.textMuted, marginTop: 4, fontSize: 10 },
  stepLabelActive: { color: Colors.primary, fontWeight: '600' },
  aiHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: Spacing.md,
  },
  aiIcon: { fontSize: 28 },
  aiInfo: { flex: 1 },
  aiTitle: { ...Typography.bodyBold, color: Colors.primary },
  aiDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  teamsSplit: { gap: Spacing.md },
  teamCol: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1.5,
  },
  teamColTitle: { ...Typography.h3, fontSize: 16, marginBottom: Spacing.sm },
  teamRow: { flexDirection: 'row', alignItems: 'center' },
  teamRowPlayer: { flex: 1 },
  moveBtn: { padding: Spacing.sm },
  stepTitle: { ...Typography.h3, color: Colors.text },
  stepHint: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  reviewSection: { ...Typography.bodyBold, color: Colors.textSecondary, marginTop: Spacing.md },
});
