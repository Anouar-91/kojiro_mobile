import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { Match } from '@/types';

interface MatchOrganizerStepsProps {
  match: Match;
  presentCount: number;
  hasComposition: boolean;
}

const STEPS = [
  { key: 'create', label: 'Créer le match' },
  { key: 'players', label: 'Joueurs confirmés' },
  { key: 'compose', label: 'Composition' },
  { key: 'play', label: 'Jouer' },
  { key: 'finish', label: 'Résultats & stats' },
] as const;

export function MatchOrganizerSteps({ match, presentCount, hasComposition }: MatchOrganizerStepsProps) {
  const getStepState = (key: (typeof STEPS)[number]['key']): 'done' | 'current' | 'pending' => {
    switch (key) {
      case 'create':
        return 'done';
      case 'players':
        if (presentCount < 2) return match.status === 'upcoming' ? 'current' : 'done';
        return 'done';
      case 'compose':
        if (match.status === 'cancelled') return hasComposition ? 'done' : 'pending';
        if (hasComposition) return 'done';
        if (presentCount >= 2 && match.status === 'upcoming' && !match.recruitmentClosed) return 'current';
        if (match.recruitmentClosed || match.status === 'live' || match.status === 'completed' || match.status === 'pending_stats') {
          return hasComposition ? 'done' : 'pending';
        }
        return 'pending';
      case 'play':
        if (match.status === 'cancelled') return 'pending';
        if (match.status === 'completed' || match.status === 'pending_stats') return 'done';
        if (match.recruitmentClosed || match.status === 'live') return 'current';
        if (hasComposition && match.status === 'upcoming') return 'current';
        return 'pending';
      case 'finish':
        if (match.status === 'cancelled') return 'pending';
        if (match.status === 'completed') return 'done';
        if (match.status === 'pending_stats') return 'current';
        if (match.recruitmentClosed || match.status === 'live') return 'current';
        return 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Organisation du match</Text>
      {STEPS.map((step, index) => {
        const state = getStepState(step.key);
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.lineCol}>
              {index > 0 && <View style={styles.line} />}
              <View
                style={[
                  styles.dot,
                  state === 'done' && styles.dotDone,
                  state === 'current' && styles.dotCurrent,
                ]}
              >
                {state === 'done' ? (
                  <Ionicons name="checkmark" size={12} color={Colors.background} />
                ) : (
                  <Text style={styles.dotNum}>{index + 1}</Text>
                )}
              </View>
            </View>
            <Text
              style={[
                styles.label,
                state === 'done' && styles.labelDone,
                state === 'current' && styles.labelCurrent,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { ...Typography.bodyBold, color: Colors.text, marginBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  lineCol: { width: 28, alignItems: 'center', position: 'relative' },
  line: {
    position: 'absolute',
    top: -18,
    width: 2,
    height: 18,
    backgroundColor: Colors.border,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  dotCurrent: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  dotNum: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  label: { ...Typography.caption, color: Colors.textMuted, flex: 1, marginLeft: Spacing.sm },
  labelDone: { color: Colors.textSecondary },
  labelCurrent: { color: Colors.primary, fontWeight: '700' },
});
