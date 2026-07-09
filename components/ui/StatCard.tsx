import { Image } from 'expo-image';
import { ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  iconSource?: ImageSourcePropType;
  iconSize?: { width: number; height: number };
  highlight?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  iconSource,
  iconSize,
  highlight = false,
}: StatCardProps) {
  return (
    <View style={[styles.card, highlight && styles.highlight]}>
      {iconSource ? (
        <View style={styles.iconSlot}>
          <Image
            source={iconSource}
            style={[styles.iconImage, iconSize]}
            contentFit="contain"
          />
        </View>
      ) : icon ? (
        <Text style={styles.icon}>{icon}</Text>
      ) : null}
      <Text style={[styles.value, highlight && styles.valueHighlight]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

interface StatGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3;
}

export function StatGrid({ stats, columns = 3 }: StatGridProps) {
  const itemBasis = columns === 3 ? '31%' : '48%';

  return (
    <View style={styles.grid}>
      {stats.map((stat, i) => (
        <View key={`${stat.label}-${i}`} style={[styles.gridItem, { flexBasis: itemBasis }]}>
          <StatCard {...stat} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridItem: {
    flexGrow: 1,
    minWidth: 0,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  highlight: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  icon: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  iconSlot: {
    height: 32,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  iconImage: {
    width: 28,
    height: 28,
  },
  value: {
    ...Typography.stat,
    fontSize: 20,
    color: Colors.text,
  },
  valueHighlight: {
    color: Colors.primary,
  },
  label: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});
