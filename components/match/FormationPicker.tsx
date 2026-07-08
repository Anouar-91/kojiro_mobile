import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import {
  FormationLayout,
  formatFormationLabel,
  getFieldPlayerCount,
  getValidFormations,
  isValidFormation,
} from '@/utils/formations';

interface FormationPickerProps {
  playersPerTeam: number;
  value: FormationLayout;
  onChange: (layout: FormationLayout) => void;
  accentColor?: string;
}

export function FormationPicker({
  playersPerTeam,
  value,
  onChange,
  accentColor = Colors.primary,
}: FormationPickerProps) {
  const presets = getValidFormations(playersPerTeam);
  const field = getFieldPlayerCount(playersPerTeam);
  const currentLabel = formatFormationLabel(value);
  const valid = isValidFormation(value, playersPerTeam);

  const adjust = (key: keyof FormationLayout, delta: number) => {
    const next = { ...value, [key]: Math.max(0, value[key] + delta) };
    if (isValidFormation(next, playersPerTeam)) onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Formation ({field} joueurs de champ + GK)</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        {presets.map((layout) => {
          const label = formatFormationLabel(layout);
          const selected = label === currentLabel;
          return (
            <Pressable
              key={label}
              style={[styles.chip, selected && { borderColor: accentColor, backgroundColor: `${accentColor}22` }]}
              onPress={() => onChange(layout)}
            >
              <Text style={[styles.chipText, selected && { color: accentColor, fontWeight: '700' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.custom}>
        <Text style={styles.customTitle}>Personnalisé</Text>
        <View style={styles.steppers}>
          <Stepper label="DEF" value={value.def} onMinus={() => adjust('def', -1)} onPlus={() => adjust('def', 1)} accentColor={accentColor} />
          <Stepper label="MIL" value={value.mid} onMinus={() => adjust('mid', -1)} onPlus={() => adjust('mid', 1)} accentColor={accentColor} />
          <Stepper label="ATT" value={value.fwd} onMinus={() => adjust('fwd', -1)} onPlus={() => adjust('fwd', 1)} accentColor={accentColor} />
        </View>
        <Text style={[styles.sum, !valid && styles.sumError]}>
          {value.def}+{value.mid}+{value.fwd} = {value.def + value.mid + value.fwd}
          {valid ? ` / ${field} ✓` : ` (il faut ${field} joueurs de champ)`}
        </Text>
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  accentColor,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  accentColor: string;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable style={styles.stepperBtn} onPress={onMinus}>
          <Ionicons name="remove" size={18} color={Colors.text} />
        </Pressable>
        <Text style={[styles.stepperValue, { color: accentColor }]}>{value}</Text>
        <Pressable style={styles.stepperBtn} onPress={onPlus}>
          <Ionicons name="add" size={18} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  title: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600', marginBottom: Spacing.sm },
  chipsScroll: { marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    marginRight: Spacing.sm,
  },
  chipText: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
  custom: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  customTitle: { ...Typography.small, color: Colors.textMuted, marginBottom: Spacing.sm },
  steppers: { flexDirection: 'row', justifyContent: 'space-around' },
  stepper: { alignItems: 'center' },
  stepperLabel: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700', marginBottom: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { ...Typography.h3, minWidth: 24, textAlign: 'center' },
  sum: { ...Typography.caption, color: Colors.success, textAlign: 'center', marginTop: Spacing.sm },
  sumError: { color: Colors.error },
});
