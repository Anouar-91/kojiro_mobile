import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import {
  LevelProgress,
  ProfileGlobalRating,
  ProfileSeasonStatsGrid,
  ProfileSectionTitle,
} from '@/components/profile/ProfileComponents';
import { StatIcon } from '@/components/ui/StatIcon';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { fetchMatchHistory } from '@/services/history';
import { useAuthStore } from '@/store/authStore';
import { MatchHistory } from '@/types';
import { formatShortDate } from '@/utils/formatters';

const CHART_MATCH_LIMIT = 12;

function RecordCard({
  wins,
  draws,
  losses,
}: {
  wins: number;
  draws: number;
  losses: number;
}) {
  const total = wins + draws + losses;
  const winPct = total > 0 ? (wins / total) * 100 : 0;
  const drawPct = total > 0 ? (draws / total) * 100 : 0;
  const lossPct = total > 0 ? (losses / total) * 100 : 0;

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordBar}>
        {winPct > 0 && <View style={[styles.recordBarSegment, styles.recordBarWin, { flex: winPct }]} />}
        {drawPct > 0 && <View style={[styles.recordBarSegment, styles.recordBarDraw, { flex: drawPct }]} />}
        {lossPct > 0 && <View style={[styles.recordBarSegment, styles.recordBarLoss, { flex: lossPct }]} />}
        {total === 0 && <View style={[styles.recordBarSegment, styles.recordBarEmpty, { flex: 1 }]} />}
      </View>
      <View style={styles.recordRow}>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: Colors.success }]}>{wins}</Text>
          <Text style={styles.recordLabel}>Victoires</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: Colors.warning }]}>{draws}</Text>
          <Text style={styles.recordLabel}>Nuls</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={[styles.recordValue, { color: Colors.error }]}>{losses}</Text>
          <Text style={styles.recordLabel}>Défaites</Text>
        </View>
      </View>
    </View>
  );
}

function AverageStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.averageCard}>
      <Text style={styles.averageValue}>{value}</Text>
      <Text style={styles.averageLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function RatingTrendChart({ data, width }: { data: number[]; width: number }) {
  const height = 130;
  const padding = 16;

  if (data.length === 0) {
    return (
      <View style={[styles.chartEmpty, { width }]}>
        <Text style={styles.chartEmptyText}>
          Joue ton premier match pour voir l&apos;évolution de ta note.
        </Text>
      </View>
    );
  }

  if (data.length === 1) {
    return (
      <View style={[styles.chartSingle, { width }]}>
        <Text style={styles.chartSingleValue}>{data[0].toFixed(1)}</Text>
        <Text style={styles.chartSingleLabel}>Note sur ton dernier match</Text>
      </View>
    );
  }

  const max = Math.max(...data, 5);
  const min = Math.min(...data, 1);
  const range = Math.max(max - min, 0.5);

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
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
      {data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return <Circle key={i} cx={x} cy={y} r={4} fill={Colors.primary} />;
      })}
    </Svg>
  );
}

function RecentMatchRow({ item }: { item: MatchHistory }) {
  const resultColor =
    item.result === 'Victoire'
      ? Colors.success
      : item.result === 'Défaite'
        ? Colors.error
        : Colors.warning;

  return (
    <View style={styles.recentRow}>
      <View style={styles.recentLeft}>
        <Text style={styles.recentDate}>{formatShortDate(item.date)}</Text>
        <Text style={styles.recentTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.recentResult, { color: resultColor }]}>{item.result}</Text>
      </View>
      <View style={styles.recentStats}>
        <View style={styles.recentStat}>
          <StatIcon name="rating" variant="compact" />
          <Text style={styles.recentStatText}>{item.rating.toFixed(1)}</Text>
        </View>
        <View style={styles.recentStat}>
          <StatIcon name="fairPlay" variant="compact" />
          <Text style={styles.recentStatText}>{item.fairPlay}/5</Text>
        </View>
        <View style={styles.recentStat}>
          <StatIcon name="defense" variant="compact" />
          <Text style={styles.recentStatText}>{item.defRating}/5</Text>
        </View>
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const user = useAuthStore((s) => s.user);
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - Spacing.xxl * 2 - Spacing.lg * 2;

  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      setHistory(await fetchMatchHistory(user.id));
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const ratingTrend = useMemo(() => {
    return [...history]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-CHART_MATCH_LIMIT)
      .map((m) => m.rating);
  }, [history]);

  const recentMatches = useMemo(() => history.slice(0, 5), [history]);

  if (!user) return null;

  const { stats } = user;
  const played = Math.max(stats.matchesPlayed, 1);
  const winRate = Math.round((stats.wins / played) * 100);
  const goalsPerMatch = (stats.goals / played).toFixed(1);
  const assistsPerMatch = (stats.assists / played).toFixed(1);
  const mvpRate = Math.round((stats.mvpCount / played) * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LevelProgress user={user} />

      <ProfileSectionTitle title="Performance" />
      <ProfileGlobalRating user={user} />
      <ProfileSeasonStatsGrid
        stats={[
          { key: 'match', label: 'Matchs', value: stats.matchesPlayed },
          { key: 'goal', label: 'Buts', value: stats.goals },
          { key: 'assist', label: 'Passes', value: stats.assists },
          { key: 'mvp', label: 'MVP', value: stats.mvpCount },
          {
            key: 'fairPlay',
            label: 'Fair-play',
            value: `${Number(stats.averageFairPlay).toFixed(1)}/5`,
            accent: true,
          },
          {
            key: 'defense',
            label: 'Défense',
            value: `${Number(stats.averageDefensiveRating).toFixed(1)}/5`,
            accent: true,
          },
        ]}
      />

      <ProfileSectionTitle title="Bilan" />
      <RecordCard wins={stats.wins} draws={stats.draws} losses={stats.losses} />

      <ProfileSectionTitle title="Moyennes" />
      <View style={styles.averagesRow}>
        <AverageStat label="Buts / match" value={stats.matchesPlayed === 0 ? '—' : goalsPerMatch} />
        <AverageStat label="Passes / match" value={stats.matchesPlayed === 0 ? '—' : assistsPerMatch} />
        <AverageStat label="Taux victoire" value={stats.matchesPlayed === 0 ? '—' : `${winRate}%`} />
        <AverageStat label="Taux MVP" value={stats.matchesPlayed === 0 ? '—' : `${mvpRate}%`} />
      </View>

      <ProfileSectionTitle title="Évolution de la note" />
      <View style={styles.chartCard}>
        {loadingHistory ? (
          <ActivityIndicator color={Colors.primary} style={styles.chartLoader} />
        ) : (
          <RatingTrendChart data={ratingTrend} width={chartWidth} />
        )}
        {!loadingHistory && ratingTrend.length > 1 && (
          <Text style={styles.chartCaption}>
            {ratingTrend.length} derniers matchs · de {ratingTrend[0].toFixed(1)} à{' '}
            {ratingTrend[ratingTrend.length - 1].toFixed(1)}
          </Text>
        )}
      </View>

      <ProfileSectionTitle title="Derniers matchs" />
      <View style={styles.recentCard}>
        {loadingHistory ? (
          <ActivityIndicator color={Colors.primary} style={styles.chartLoader} />
        ) : recentMatches.length === 0 ? (
          <Text style={styles.chartEmptyText}>Aucun match enregistré pour le moment.</Text>
        ) : (
          recentMatches.map((item, index) => (
            <View key={item.id}>
              <RecentMatchRow item={item} />
              {index < recentMatches.length - 1 && <View style={styles.recentDivider} />}
            </View>
          ))
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  recordCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.lg,
  },
  recordBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceHighlight,
  },
  recordBarSegment: {
    height: '100%',
  },
  recordBarWin: { backgroundColor: Colors.success },
  recordBarDraw: { backgroundColor: Colors.warning },
  recordBarLoss: { backgroundColor: Colors.error },
  recordBarEmpty: { backgroundColor: Colors.border },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  recordItem: { alignItems: 'center' },
  recordValue: { ...Typography.h2, fontWeight: '800' },
  recordLabel: { ...Typography.caption, color: Colors.textMuted, marginTop: 4 },
  averagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  averageCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  averageValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  averageLabel: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  chartCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  chartLoader: {
    paddingVertical: Spacing.xl,
  },
  chartEmpty: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  chartSingle: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  chartSingleValue: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.primary,
  },
  chartSingleLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  chartCaption: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  recentCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  recentLeft: {
    flex: 1,
    minWidth: 0,
  },
  recentDate: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  recentTitle: {
    ...Typography.bodyBold,
    color: Colors.text,
    marginTop: 2,
  },
  recentResult: {
    ...Typography.small,
    fontWeight: '700',
    marginTop: 2,
  },
  recentStats: {
    gap: 6,
    alignItems: 'flex-end',
  },
  recentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentStatText: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'right',
  },
  recentDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  bottomSpacer: { height: Spacing.xxxl },
});
