import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UpcomingMatchCard } from '@/components/home/MatchCards';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { MATCH_FORMAT_PRESETS, Match } from '@/types';
import {
  NEARBY_MATCH_RADIUS_KM,
  WIDER_MATCH_RADIUS_KM,
  distanceKm,
} from '@/utils/geo';
import { isUserRegisteredForMatch } from '@/utils/matchAttendance';

type FormatFilter = 'all' | number;
type ProximityFilter = 'all' | typeof NEARBY_MATCH_RADIUS_KM | typeof WIDER_MATCH_RADIUS_KM;
type ScopeFilter = 'all' | 'mine';
type SortBy = 'date' | 'distance';

interface MatchWithDistance {
  match: Match;
  distance: number;
}

function isMyMatch(match: Match, userId: string | undefined): boolean {
  if (!userId) return false;
  return match.organizerId === userId || isUserRegisteredForMatch(match, userId);
}

function sortMatches(items: MatchWithDistance[], sortBy: SortBy): MatchWithDistance[] {
  const sorted = [...items];
  if (sortBy === 'distance') {
    return sorted.sort((a, b) => a.distance - b.distance);
  }
  return sorted.sort((a, b) => {
    const da = new Date(`${a.match.date}T${a.match.time}`).getTime();
    const db = new Date(`${b.match.date}T${b.match.time}`).getTime();
    return da - db;
  });
}

export default function MatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const matches = useMatchStore((s) => s.matches);
  const { position: userPosition } = useCurrentLocation(user ?? undefined);
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [proximityFilter, setProximityFilter] = useState<ProximityFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const refresh = useAppRefresh();
  const [refreshing, setRefreshing] = useState(false);

  const activeMatches = useMemo(
    () => matches.filter((m) => m.status === 'upcoming' || m.status === 'live'),
    [matches]
  );

  const filteredMatches = useMemo<MatchWithDistance[]>(() => {
    let pool = activeMatches.map((match) => ({
      match,
      distance: distanceKm(userPosition, match.location),
    }));

    if (formatFilter !== 'all') {
      pool = pool.filter(({ match }) => match.format === formatFilter);
    }

    if (proximityFilter !== 'all') {
      pool = pool.filter(({ distance }) => distance <= proximityFilter);
    }

    if (scopeFilter === 'mine') {
      pool = pool.filter(({ match }) => isMyMatch(match, user?.id));
    }

    return sortMatches(pool, sortBy);
  }, [activeMatches, formatFilter, proximityFilter, scopeFilter, sortBy, userPosition, user?.id]);

  const myMatches = useMemo(
    () => filteredMatches.filter(({ match }) => isMyMatch(match, user?.id)),
    [filteredMatches, user?.id]
  );

  const discoverMatches = useMemo(
    () => filteredMatches.filter(({ match }) => !isMyMatch(match, user?.id)),
    [filteredMatches, user?.id]
  );

  const showDiscover = scopeFilter === 'all';

  const emptyMessage = useMemo(() => {
    if (formatFilter !== 'all' && proximityFilter !== 'all') {
      return `Aucun match ${formatFilter}v${formatFilter} à moins de ${proximityFilter} km.`;
    }
    if (formatFilter !== 'all') {
      return `Aucun match ${formatFilter}v${formatFilter} pour le moment.`;
    }
    if (proximityFilter !== 'all') {
      return `Aucun match à moins de ${proximityFilter} km. Élargis la zone ou consulte la carte.`;
    }
    if (scopeFilter === 'mine') {
      return 'Tu n\'as aucun match à venir. Rejoins-en un ou crée le tien.';
    }
    return 'Aucun match à venir pour le moment.';
  }, [formatFilter, proximityFilter, scopeFilter]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(formatFilter === 'all' ? 'Tous formats' : `${formatFilter}v${formatFilter}`);
    parts.push(proximityFilter === 'all' ? 'Toute zone' : `< ${proximityFilter} km`);
    if (scopeFilter === 'mine') parts.push('Mes matchs');
    parts.push(sortBy === 'date' ? 'Date' : 'Distance');
    return parts.join(' · ');
  }, [formatFilter, proximityFilter, scopeFilter, sortBy]);

  const hasActiveFilters =
    formatFilter !== 'all' ||
    proximityFilter !== 'all' ||
    scopeFilter === 'mine' ||
    sortBy !== 'date';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderMatch = ({ match, distance }: MatchWithDistance) => (
    <UpcomingMatchCard
      key={match.id}
      match={match}
      distance={distance}
      onPress={() => router.push(`/match/${match.id}`)}
    />
  );

  const hasResults = showDiscover ? myMatches.length + discoverMatches.length > 0 : myMatches.length > 0;

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
        <Pressable
          style={styles.filterBar}
          onPress={() => setFiltersOpen((open) => !open)}
        >
          <Ionicons name="options-outline" size={18} color={Colors.primary} />
          <Text style={styles.filterSummary} numberOfLines={1}>
            {filterSummary}
          </Text>
          {hasActiveFilters && <View style={styles.filterDot} />}
          <Ionicons
            name={filtersOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textMuted}
          />
        </Pressable>

        {filtersOpen && (
          <View style={styles.filtersPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <Chip
                label="Tous"
                selected={formatFilter === 'all'}
                onPress={() => setFormatFilter('all')}
              />
              {MATCH_FORMAT_PRESETS.map((n) => (
                <Chip
                  key={n}
                  label={`${n}v${n}`}
                  selected={formatFilter === n}
                  onPress={() => setFormatFilter(n)}
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <Chip
                label="Toute zone"
                selected={proximityFilter === 'all'}
                onPress={() => setProximityFilter('all')}
              />
              <Chip
                label={`< ${NEARBY_MATCH_RADIUS_KM} km`}
                selected={proximityFilter === NEARBY_MATCH_RADIUS_KM}
                onPress={() => setProximityFilter(NEARBY_MATCH_RADIUS_KM)}
              />
              <Chip
                label={`< ${WIDER_MATCH_RADIUS_KM} km`}
                selected={proximityFilter === WIDER_MATCH_RADIUS_KM}
                onPress={() => setProximityFilter(WIDER_MATCH_RADIUS_KM)}
              />
              <Chip
                label="Tous"
                selected={scopeFilter === 'all'}
                onPress={() => setScopeFilter('all')}
              />
              <Chip
                label="Mes matchs"
                selected={scopeFilter === 'mine'}
                onPress={() => setScopeFilter('mine')}
              />
              <Chip
                label="Date"
                selected={sortBy === 'date'}
                onPress={() => setSortBy('date')}
              />
              <Chip
                label="Distance"
                selected={sortBy === 'distance'}
                onPress={() => setSortBy('distance')}
              />
            </ScrollView>
          </View>
        )}

        {!hasResults ? (
          <View style={styles.empty}>
            <Ionicons name="football-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            <View style={styles.emptyActions}>
              {proximityFilter !== 'all' && (
                <Button title="Élargir la zone" onPress={() => setProximityFilter('all')} variant="ghost" />
              )}
              <Button title="Voir la carte" onPress={() => router.push('/map')} variant="ghost" />
              <Button title="Créer un match" onPress={() => router.push('/match/create')} />
            </View>
          </View>
        ) : (
          <>
            {myMatches.length > 0 && (
              <>
                <SectionHeader title="Mes matchs" />
                {myMatches.map(renderMatch)}
              </>
            )}
            {showDiscover && discoverMatches.length > 0 && (
              <>
                <SectionHeader title="À découvrir" />
                {discoverMatches.map(renderMatch)}
              </>
            )}
          </>
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSummary: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
    fontWeight: '600',
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  filtersPanel: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    gap: Spacing.lg,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyActions: {
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
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
