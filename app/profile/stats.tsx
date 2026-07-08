import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { StatGrid } from '@/components/ui/StatCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

const CHART_DATA = [3.8, 4.0, 4.2, 3.9, 4.5, 4.3, 4.6, 4.4, 4.7, 4.5];

function PerformanceChart() {
  const width = 320;
  const height = 120;
  const padding = 16;
  const max = Math.max(...CHART_DATA);
  const min = Math.min(...CHART_DATA) - 0.5;
  const range = max - min;

  const points = CHART_DATA.map((val, i) => {
    const x = padding + (i / (CHART_DATA.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Évolution de la note</Text>
      <Svg width={width} height={height}>
        {[0, 1, 2, 3].map((i) => (
          <Line
            key={i}
            x1={padding}
            y1={padding + (i * (height - padding * 2)) / 3}
            x2={width - padding}
            y2={padding + (i * (height - padding * 2)) / 3}
            stroke={Colors.border}
            strokeWidth={1}
          />
        ))}
        <Polyline points={points} fill="none" stroke={Colors.primary} strokeWidth={2.5} />
        {CHART_DATA.map((val, i) => {
          const x = padding + (i / (CHART_DATA.length - 1)) * (width - padding * 2);
          const y = height - padding - ((val - min) / range) * (height - padding * 2);
          return <Circle key={i} cx={x} cy={y} r={4} fill={Colors.primary} />;
        })}
      </Svg>
    </View>
  );
}

export default function StatsScreen() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const winRate = Math.round((user.stats.wins / Math.max(user.stats.matchesPlayed, 1)) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.ratingHero}>
        <Text style={styles.ratingValue}>{user.stats.averageRating}</Text>
        <Text style={styles.ratingLabel}>Note moyenne</Text>
      </View>

      <StatGrid
        stats={[
          { label: 'Buts', value: user.stats.goals, highlight: true },
          { label: 'Passes', value: user.stats.assists },
          { label: 'Victoires', value: user.stats.wins },
          { label: 'Taux victoire', value: `${winRate}%` },
          { label: 'MVP', value: user.stats.mvpCount },
          { label: 'Minutes', value: user.stats.minutesPlayed },
          { label: 'Tirs cadrés', value: `${user.stats.shotsOnTarget}%` },
          { label: 'Précision passes', value: `${user.stats.passAccuracy}%` },
          { label: 'Fair-play', value: `${user.stats.averageFairPlay}/5` },
        ]}
        columns={3}
      />

      <PerformanceChart />

      <View style={styles.recordRow}>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: Colors.success }]}>{user.stats.wins}</Text>
          <Text style={styles.recordLabel}>Victoires</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: Colors.warning }]}>{user.stats.draws}</Text>
          <Text style={styles.recordLabel}>Nuls</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: Colors.error }]}>{user.stats.losses}</Text>
          <Text style={styles.recordLabel}>Défaites</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  ratingHero: { alignItems: 'center', marginBottom: Spacing.xxl },
  ratingValue: { fontSize: 56, fontWeight: '900', color: Colors.primary },
  ratingLabel: { ...Typography.body, color: Colors.textSecondary },
  chartContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartTitle: { ...Typography.bodyBold, color: Colors.text, marginBottom: Spacing.md },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.xxl,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  recordItem: { alignItems: 'center' },
  recordValue: { ...Typography.h2, fontWeight: '800' },
  recordLabel: { ...Typography.caption, color: Colors.textMuted, marginTop: 4 },
});
