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
  filterRostersToPresent,
  filterSlotAssignmentsToPresent,
  normalizeTeamRosters,
  saveMatchComposition,
} from '@/services/composition';
import { createNotification } from '@/services/notifications';
import { useRefreshMatchProfiles } from '@/hooks/useRefreshMatchProfiles';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { getPresentUsersFromMatch, useProfileStore } from '@/store/profileStore';
import { Match, User } from '@/types';
import { MatchComposition, TeamSide } from '@/types/lineup';
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
import {
  canEditComposition,
  CompositionRole,
  getCompositionLockMessage,
  getCompositionRole,
  getRegisteredPresentUserIds,
} from '@/utils/compositionPermissions';
import { getAttendeeParticipantId, resolveParticipantUser, uniqueParticipantIds } from '@/utils/guestAttendees';
import { balanceTeams } from '@/utils/teamBalancer';

type Step = 'teams' | 'formation-a' | 'formation-b' | 'review';

function getPresentParticipantIds(attendees: Match['attendees']): string[] {
  return uniqueParticipantIds(
    attendees.filter((a) => a.status === 'present').map((a) => getAttendeeParticipantId(a))
  );
}

function formatWithdrawnNames(
  removedIds: string[],
  resolveName: (id: string) => string | null
): string {
  const names = removedIds.map((id) => resolveName(id) ?? 'Un joueur');
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

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

  useRefreshMatchProfiles(match);

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
  const [compositionMeta, setCompositionMeta] = useState<MatchComposition | null>(null);
  const rostersRef = useRef({ teamAIds, teamBIds });
  const skipNextSyncAlertRef = useRef(true);
  rostersRef.current = { teamAIds, teamBIds };

  const presentIdsKey = useMemo(
    () => (match ? getPresentParticipantIds(match.attendees).sort().join(',') : ''),
    [match?.attendees]
  );
  const presentParticipantIds = useMemo(
    () => (match ? getPresentParticipantIds(match.attendees) : []),
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
      setSlotsA(autoToSlotAssignments(autoFillLineup(aIds, slotsABuilt, (id) => players.find((p) => p.id === id)?.position)));
      setSlotsB(autoToSlotAssignments(autoFillLineup(bIds, slotsBBuilt, (id) => players.find((p) => p.id === id)?.position)));
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
        if (active) setCompositionMeta(composition);
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
          setTeamAIds(uniqueParticipantIds(aIds));
          setTeamBIds(uniqueParticipantIds(bIds));
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
    if (!match?.id) return;
    let active = true;
    fetchMatchComposition(match.id)
      .then((composition) => {
        if (active) setCompositionMeta(composition);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [match?.id, presentIdsKey]);

  useEffect(() => {
    if (loading || !match || !presentIdsKey) return;

    const presentIds = presentParticipantIds;
    const presentSet = new Set(presentIds);
    const { teamAIds: prevA, teamBIds: prevB } = rostersRef.current;
    const removedIds = [...new Set([...prevA, ...prevB])].filter((id) => !presentSet.has(id));
    const synced = syncRostersWithPresentPlayers(prevA, prevB, presentIds);

    if (synced.changed) {
      setTeamAIds(uniqueParticipantIds(synced.teamAIds));
      setTeamBIds(uniqueParticipantIds(synced.teamBIds));
    }

    setSlotsA((prev) => removeAbsentFromSlots(prev, presentSet));
    setSlotsB((prev) => removeAbsentFromSlots(prev, presentSet));

    if (!skipNextSyncAlertRef.current && removedIds.length > 0) {
      const names = formatWithdrawnNames(removedIds, (id) => resolveParticipantUser(id, match, getProfile)?.name ?? null);
      const body =
        removedIds.length === 1
          ? `${names} n'est plus disponible et a été retiré des équipes.`
          : `${names} ne sont plus disponibles et ont été retirés des équipes.`;
      Alert.alert('Effectif mis à jour', body);
    }
    skipNextSyncAlertRef.current = false;
  }, [presentIdsKey, presentParticipantIds, loading, match, getProfile]);

  const registeredPresentIds = useMemo(
    () => (match ? getRegisteredPresentUserIds(match.attendees) : new Set<string>()),
    [match?.attendees]
  );

  const role: CompositionRole = getCompositionRole(
    user?.id,
    match?.organizerId ?? '',
    compositionMeta,
    registeredPresentIds
  );
  const captainSide: TeamSide | null = role === 'captain_a' ? 'A' : role === 'captain_b' ? 'B' : null;
  const isOrganizer = role === 'organizer';
  const canEdit = match ? canEditComposition(role, match.status, compositionMeta) : false;

  useEffect(() => {
    if (loading || role === 'organizer' || role === 'viewer') return;
    if (captainSide === 'A') setStep('formation-a');
    if (captainSide === 'B') setStep('formation-b');
  }, [loading, role, captainSide]);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Chargement...</Text>
      </View>
    );
  }

  if (!canEdit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{getCompositionLockMessage(role, match.status)}</Text>
        <Button
          title="Voir la composition"
          onPress={() => router.push({ pathname: '/match/lineup', params: { id: match.id } })}
          variant="outline"
          style={{ marginTop: Spacing.lg }}
        />
      </View>
    );
  }

  const resolveUser = (id: string) => resolveParticipantUser(id, match, getProfile);

  const playersA = uniqueParticipantIds(teamAIds).map(resolveUser).filter(Boolean) as User[];
  const playersB = uniqueParticipantIds(teamBIds).map(resolveUser).filter(Boolean) as User[];
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
    const getPosition = (id: string) => resolveUser(id)?.position;
    setter(autoToSlotAssignments(autoFillLineup(ids, slots, getPosition)));
  };

  const handleSave = async (
    publish: boolean,
    editSide: TeamSide | null = null,
    options?: { requireFormations?: boolean; stayOnScreen?: boolean }
  ) => {
    const side = editSide ?? captainSide;
    const requireFormations = options?.requireFormations ?? Boolean(side);

    if (requireFormations) {
      if (side) {
        const layout = side === 'A' ? formationLayoutA : formationLayoutB;
        if (!isValidFormation(layout, match.format)) {
          Alert.alert('Formation invalide', 'Vérifie que DEF + MIL + ATT = joueurs de terrain.');
          return;
        }
      } else if (
        !isValidFormation(formationLayoutA, match.format) ||
        !isValidFormation(formationLayoutB, match.format)
      ) {
        Alert.alert('Formation invalide', 'Vérifie que DEF + MIL + ATT = joueurs de terrain pour chaque équipe.');
        return;
      }
    }

    setSaving(true);
    try {
      const {
        teamAIds: presentA,
        teamBIds: presentB,
        removedIds,
      } = filterRostersToPresent(teamAIds, teamBIds, presentParticipantIds);
      const saveSlotsA = filterSlotAssignmentsToPresent(slotsA, presentParticipantIds);
      const saveSlotsB = filterSlotAssignmentsToPresent(slotsB, presentParticipantIds);

      if (removedIds.length > 0) {
        setTeamAIds(presentA);
        setTeamBIds(presentB);
        setSlotsA(saveSlotsA);
        setSlotsB(saveSlotsB);
      }

      const { teamAIds: rosterA, teamBIds: rosterB } = normalizeTeamRosters(presentA, presentB);
      const lineups = side
        ? buildLineupsFromState(
            side === 'A' ? rosterA : [],
            side === 'B' ? rosterB : [],
            side === 'A' ? saveSlotsA : {},
            side === 'B' ? saveSlotsB : {},
            formationSlotsA,
            formationSlotsB
          )
        : buildLineupsFromState(
            rosterA,
            rosterB,
            saveSlotsA,
            saveSlotsB,
            formationSlotsA,
            formationSlotsB
          );

      await saveMatchComposition(match.id, labelA, labelB, lineups, {
        publish,
        editSide: side,
      });

      const updated = await fetchMatchComposition(match.id);
      setCompositionMeta(updated);

      if (publish) {
        const allIds = [...rosterA, ...rosterB];
        await Promise.all(
          allIds
            .filter((uid) => uid !== user?.id && !uid.startsWith('guest:'))
            .map((uid) =>
              createNotification(uid, {
                type: 'team_assigned',
                title: 'Composition publiée',
                body: `Les équipes sont publiées pour "${match.title}".`,
                data: { matchId: match.id },
              }).catch(() => {})
            )
        );
        await fetchMatches(user?.id);
        Alert.alert('Composition publiée', 'Les joueurs peuvent consulter la formation.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (options?.stayOnScreen) {
        await fetchMatches(user?.id);
      } else {
        await fetchMatches(user?.id);
        const message = side
          ? `Formation équipe ${side} mise à jour.`
          : 'Les effectifs ont été enregistrés.';
        Alert.alert(side ? 'Équipe enregistrée' : 'Effectifs enregistrés', message, [
          { text: 'OK', onPress: () => (side ? router.back() : undefined) },
        ]);
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Sauvegarde impossible');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const persistRosters = async () => {
    await handleSave(false, null, { requireFormations: false, stayOnScreen: true });
  };

  const goToStep = async (next: Step) => {
    if (step === 'teams' && next !== 'teams' && isOrganizer) {
      try {
        await persistRosters();
      } catch {
        return;
      }
    }
    setStep(next);
  };

  const steps: { key: Step; label: string }[] = isOrganizer
    ? [
        { key: 'teams', label: 'Équipes' },
        { key: 'formation-a', label: 'Form. A' },
        { key: 'formation-b', label: 'Form. B' },
        { key: 'review', label: 'Valider' },
      ]
    : captainSide === 'A'
      ? [{ key: 'formation-a', label: 'Équipe A' }]
      : [{ key: 'formation-b', label: 'Équipe B' }];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {isOrganizer && !compositionMeta?.validatedAt && allPresent.length >= 2 && (
        <View style={styles.autoBanner}>
          <Text style={styles.autoBannerTitle}>Compo auto-proposée</Text>
          <Text style={styles.autoBannerDesc}>
            Les équipes sont pré-équilibrées. Ajuste si besoin, désigne des capitaines depuis le match, puis publie.
          </Text>
        </View>
      )}

      {captainSide && (
        <View style={styles.captainBanner}>
          <Text style={styles.captainBannerTitle}>Capitaine équipe {captainSide}</Text>
          <Text style={styles.captainBannerDesc}>
            Place les joueurs de ton équipe. Tu peux modifier même après publication.
          </Text>
        </View>
      )}

      <View style={styles.stepper}>
        {steps.map((s, i) => (
          <Pressable key={s.key} style={styles.stepItem} onPress={() => goToStep(s.key)}>
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
                Déplace les joueurs entre A et B. Les effectifs sont enregistrés automatiquement à l'étape suivante.
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
          <Button
            title="Enregistrer les effectifs"
            onPress={() => handleSave(false, null, { requireFormations: false })}
            loading={saving}
            variant="outline"
            icon="save-outline"
            fullWidth
          />
          <Button
            title="Publier les effectifs"
            onPress={() => handleSave(true, null, { requireFormations: false })}
            loading={saving}
            variant="secondary"
            icon="checkmark-circle-outline"
            fullWidth
          />
          <Button
            title="Formation équipe A"
            onPress={() => goToStep('formation-a')}
            fullWidth
            disabled={teamAIds.length === 0}
            loading={saving}
          />
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
            {isOrganizer ? (
              <>
                <Button title="Retour" onPress={() => goToStep('teams')} variant="ghost" />
                <Button title="Équipe B" onPress={() => goToStep('formation-b')} />
              </>
            ) : (
              <Button
                title="Enregistrer mon équipe"
                onPress={() => handleSave(false, 'A')}
                loading={saving}
                fullWidth
                icon="save-outline"
              />
            )}
          </View>
          {captainSide === 'A' && playersB.length > 0 && (
            <OpponentPreview
              title={`Équipe B — ${labelB}`}
              slots={formationSlotsB}
              players={playersB}
              slotAssignments={slotsB}
              accentColor={Colors.info}
            />
          )}
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
            {isOrganizer ? (
              <>
                <Button title="Équipe A" onPress={() => goToStep('formation-a')} variant="ghost" />
                <Button title="Récapitulatif" onPress={() => goToStep('review')} />
              </>
            ) : (
              <Button
                title="Enregistrer mon équipe"
                onPress={() => handleSave(false, 'B')}
                loading={saving}
                fullWidth
                icon="save-outline"
              />
            )}
          </View>
          {captainSide === 'B' && playersA.length > 0 && (
            <OpponentPreview
              title={`Équipe A — ${labelA}`}
              slots={formationSlotsA}
              players={playersA}
              slotAssignments={slotsA}
              accentColor={Colors.primary}
            />
          )}
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
            onPress={() => handleSave(true, null, { requireFormations: false })}
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

function OpponentPreview({
  title,
  slots,
  players,
  slotAssignments,
  accentColor,
}: {
  title: string;
  slots: ReturnType<typeof buildFormationSlotsFromLayout>;
  players: User[];
  slotAssignments: Record<string, string>;
  accentColor: string;
}) {
  return (
    <View style={styles.opponentWrap}>
      <Text style={styles.opponentTitle}>{title} — adverse</Text>
      <PitchFormation
        slots={slots}
        players={players}
        slotAssignments={slotAssignments}
        readOnly
        accentColor={accentColor}
      />
    </View>
  );
}

function formatPlayerCount(count: number): string {
  return count === 1 ? '1 joueur' : `${count} joueurs`;
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
  const count = uniqueParticipantIds(userIds).length;

  return (
    <View style={[styles.teamCol, { borderColor: `${color}50` }]}>
      <View style={styles.teamColHeader}>
        <Text style={[styles.teamColTitle, { color }]}>{title}</Text>
        <View style={[styles.teamCountBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
          <Text style={[styles.teamCountText, { color }]}>{formatPlayerCount(count)}</Text>
        </View>
      </View>
      {uniqueParticipantIds(userIds).map((uid) => {
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
  teamColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  teamColTitle: { ...Typography.h3, fontSize: 16, flex: 1 },
  teamCountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  teamCountText: { ...Typography.caption, fontWeight: '700' },
  teamRow: { flexDirection: 'row', alignItems: 'center' },
  teamRowPlayer: { flex: 1 },
  moveBtn: { padding: Spacing.sm },
  stepTitle: { ...Typography.h3, color: Colors.text },
  stepHint: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  reviewSection: { ...Typography.bodyBold, color: Colors.textSecondary, marginTop: Spacing.md },
  autoBanner: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  autoBannerTitle: { ...Typography.bodyBold, color: Colors.primary },
  autoBannerDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  captainBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.info,
    marginBottom: Spacing.md,
  },
  captainBannerTitle: { ...Typography.bodyBold, color: Colors.info },
  captainBannerDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  opponentWrap: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  opponentTitle: { ...Typography.bodyBold, color: Colors.textSecondary },
});
