import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PitchFormationReadOnly } from '@/components/match/PitchFormation';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchMatchComposition, getSlotAssignments } from '@/services/composition';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { User } from '@/types';
import { MatchComposition } from '@/types/lineup';
import {
  buildFormationSlotsFromLayout,
  getDefaultFormation,
  parseFormationLabel,
} from '@/utils/formations';
import { buildGuestUser, isGuestPlayerId, parseGuestPlayerId, uniqueUsersById } from '@/utils/guestAttendees';

export default function LineupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const getProfile = useProfileStore((s) => s.getProfile);
  const [composition, setComposition] = useState<MatchComposition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!match) return;
    fetchMatchComposition(match.id)
      .then(setComposition)
      .catch(() => setComposition(null))
      .finally(() => setLoading(false));
  }, [match]);

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
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!composition || composition.lineups.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>La composition n'a pas encore été publiée par l'organisateur.</Text>
      </View>
    );
  }

  const playersForSide = (side: 'A' | 'B'): User[] =>
    uniqueUsersById(
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{match.title}</Text>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  muted: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  title: { ...Typography.h2, color: Colors.text, marginBottom: Spacing.sm },
  teamTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.md },
});
