import { StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, icon, highlight = false }: StatCardProps) {
  return (
    <View style={[styles.card, highlight && styles.highlight]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
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
  return (
    <View style={styles.grid}>
      {stats.map((stat, i) => (
        <View key={i} style={{ width: columns === 3 ? '31%' : '48%' }}>
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
    justifyContent: 'space-between',
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
