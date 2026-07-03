import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UpcomingMatchCard } from '@/components/home/MatchCards';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { useMatchStore } from '@/store/matchStore';
import { MatchFormat } from '@/types';

type FilterType = 'all' | MatchFormat;

export default function MatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const matches = useMatchStore((s) => s.matches);
  const [filter, setFilter] = useState<FilterType>('all');
  const refresh = useAppRefresh();
  const [refreshing, setRefreshing] = useState(false);

  const filtered = filter === 'all' ? matches : matches.filter((m) => m.format === filter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Matchs</Text>
        <Pressable onPress={() => router.push('/map')} style={styles.mapBtn}>
          <Ionicons name="map-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.filters}>
          <ChipGroup
            options={[
              { label: 'Tous', value: 'all' },
              { label: '5v5', value: 5 },
              { label: '7v7', value: 7 },
              { label: '11v11', value: 11 },
            ]}
            selected={filter}
            onSelect={(v) => setFilter(v as FilterType)}
          />
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="football-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Aucun match trouvé</Text>
            <Button title="Créer un match" onPress={() => router.push('/match/create')} />
          </View>
        ) : (
          filtered.map((match) => (
            <UpcomingMatchCard
              key={match.id}
              match={match}
              onPress={() => router.push(`/match/${match.id}`)}
            />
          ))
        )}

        <Pressable onPress={() => router.push('/profile/history')} style={styles.historyLink}>
          <Ionicons name="time-outline" size={20} color={Colors.primary} />
          <Text style={styles.historyText}>Voir l'historique des matchs</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push('/match/create')}>
        <Ionicons name="add" size={28} color={Colors.background} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  filters: {
    marginBottom: Spacing.lg,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    gap: Spacing.lg,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyText: {
    ...Typography.bodyBold,
    color: Colors.primary,
    flex: 1,
    fontSize: 14,
  },
  bottomSpacer: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
