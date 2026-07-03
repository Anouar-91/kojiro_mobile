import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
}

export function Chip({ label, selected = false, onPress, icon }: ChipProps) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

interface ChipGroupProps {
  options: { label: string; value: string | number; icon?: string }[];
  selected: string | number;
  onSelect: (value: string | number) => void;
}

export function ChipGroup({ options, selected, onSelect }: ChipGroupProps) {
  return (
    <View style={styles.group}>
      {options.map((opt) => (
        <Chip
          key={String(opt.value)}
          label={opt.label}
          icon={opt.icon}
          selected={selected === opt.value}
          onPress={() => onSelect(opt.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  selected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  icon: {
    marginRight: Spacing.xs,
    fontSize: 14,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  labelSelected: {
    color: Colors.primary,
  },
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
