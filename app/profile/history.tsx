import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { StatIcon } from '@/components/ui/StatIcon';
import { ProfileStatIconKey } from '@/constants/profileIcons';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchMatchHistory } from '@/services/history';
import { useAuthStore } from '@/store/authStore';
import { MatchHistory } from '@/types';
import { formatShortDate } from '@/utils/formatters';

function HistoryStat({ icon, text }: { icon: ProfileStatIconKey; text: string }) {
  return (
    <View style={styles.stat}>
      <StatIcon name={icon} variant="compact" />
      <Text style={styles.statText}>{text}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setHistory(await fetchMatchHistory(user.id));
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="football-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Aucun match joué</Text>
        <Text style={styles.emptyText}>
          Ton historique apparaîtra ici après tes premières parties.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {history.map((item) => (
        <Pressable
          key={item.id}
          style={styles.card}
          onPress={() => {
            if (item.matchId) {
              router.push({ pathname: '/match/recap', params: { id: item.matchId } });
            }
          }}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.date}>{formatShortDate(item.date)}</Text>
            {item.mvp && <Badge label="MVP" variant="primary" />}
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.resultRow}>
            <Badge
              label={item.result}
              variant={
                item.result === 'Victoire' ? 'success' : item.result === 'Défaite' ? 'error' : 'warning'
              }
            />
            <Text style={styles.score}>{item.score}</Text>
          </View>
          <View style={styles.statsRow}>
            <HistoryStat icon="rating" text={String(item.rating)} />
            <HistoryStat icon="fairPlay" text={`${item.fairPlay}/5`} />
            <HistoryStat icon="defense" text={`${item.defRating}/5`} />
            <HistoryStat
              icon="goal"
              text={`${item.goals} but${item.goals > 1 ? 's' : ''}`}
            />
            <HistoryStat
              icon="assist"
              text={`${item.assists} passe${item.assists > 1 ? 's' : ''}`}
            />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.lg },
  emptyText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  date: { ...Typography.caption, color: Colors.textMuted },
  title: { ...Typography.bodyBold, color: Colors.text, marginBottom: Spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  score: { ...Typography.h3, color: Colors.text },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...Typography.caption, color: Colors.textSecondary },
});
