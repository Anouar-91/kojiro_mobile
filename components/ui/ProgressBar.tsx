import { StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface ProgressBarProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
  label?: string;
  color?: string;
}

export function ProgressBar({
  progress,
  height = 6,
  showLabel = false,
  label,
  color = Colors.primary,
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={styles.container}>
      {(showLabel || label) && (
        <View style={styles.labelRow}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showLabel && (
            <Text style={styles.percent}>{Math.round(clampedProgress * 100)}%</Text>
          )}
        </View>
      )}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress * 100}%`,
              height,
              borderRadius: height / 2,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  percent: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '600',
  },
  track: {
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: BorderRadius.full,
  },
});
