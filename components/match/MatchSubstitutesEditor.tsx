import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { MatchFormat } from '@/types';
import { clampSubstitutesPerTeam, getMaxPlayers } from '@/utils/formatters';

interface MatchSubstitutesEditorProps {
  playersPerTeam: MatchFormat;
  substitutesPerTeam: number;
  saving?: boolean;
  onIncrease: (nextValue: number) => void;
}

export function MatchSubstitutesEditor({
  playersPerTeam,
  substitutesPerTeam,
  saving = false,
  onIncrease,
}: MatchSubstitutesEditorProps) {
  const atMax = substitutesPerTeam >= 10;
  const maxPlayers = getMaxPlayers(playersPerTeam, substitutesPerTeam);
  const nextValue = clampSubstitutesPerTeam(substitutesPerTeam + 1);
  const addedPlaces = (nextValue - substitutesPerTeam) * 2;

  return (
    <View style={styles.card}>
      <Text style={styles.summary}>
        {playersPerTeam} titulaires + {substitutesPerTeam} remp. par équipe · {maxPlayers} places au total
      </Text>

      <View style={styles.stepperRow}>
        <View style={[styles.stepperBtn, styles.stepperBtnDisabled]}>
          <Ionicons name="remove" size={22} color={Colors.textMuted} />
        </View>

        <View style={styles.stepperValue}>
          <Text style={styles.stepperNumber}>{substitutesPerTeam}</Text>
          <Text style={styles.stepperUnit}>remplaçants / équipe</Text>
        </View>

        <Pressable
          style={[styles.stepperBtn, (atMax || saving) && styles.stepperBtnDisabled]}
          onPress={() => onIncrease(nextValue)}
          disabled={atMax || saving}
          accessibilityRole="button"
          accessibilityLabel="Augmenter le nombre de remplaçants"
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="add" size={22} color={atMax ? Colors.textMuted : Colors.text} />
          )}
        </Pressable>
      </View>

      <Text style={styles.hint}>
        {atMax
          ? 'Maximum atteint (10 remplaçants par équipe).'
          : `Tu peux augmenter les remplaçants après la création (+${addedPlaces} place${addedPlaces > 1 ? 's' : ''} au total par remplaçant ajouté).`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  summary: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.45,
  },
  stepperValue: {
    alignItems: 'center',
    minWidth: 120,
  },
  stepperNumber: {
    ...Typography.h1,
    color: Colors.primary,
  },
  stepperUnit: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  hint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
