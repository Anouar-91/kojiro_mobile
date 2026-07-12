import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NearbyMatchCard } from '@/components/home/MatchCards';
import { MatchMapView } from '@/components/map/MatchMapView';
import { Chip } from '@/components/ui/Chip';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { MATCH_FORMAT_PRESETS, Match } from '@/types';
import { distanceKm } from '@/utils/geo';
import { isMatchListedAsUpcoming } from '@/utils/matchDates';

interface MatchWithDistance {
  match: Match;
  distance: number;
}

type FormatFilter = 'all' | number;

export default function MapScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allMatches = useMatchStore((s) => s.matches);
  const { position: userPosition, loading: locating, refresh: refreshLocation } = useCurrentLocation(
    user ?? undefined
  );

  const upcomingMatches = useMemo(
    () => allMatches.filter((m) => m.status === 'upcoming' && isMatchListedAsUpcoming(m)),
    [allMatches]
  );

  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [visibleMatchIds, setVisibleMatchIds] = useState<string[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredMatches = useMemo(() => {
    if (formatFilter === 'all') return upcomingMatches;
    return upcomingMatches.filter((m) => m.format === formatFilter);
  }, [upcomingMatches, formatFilter]);

  useEffect(() => {
    if (selectedId && !filteredMatches.some((m) => m.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredMatches, selectedId]);

  const handleViewportChange = useCallback((ids: string[]) => {
    setVisibleMatchIds(ids);
  }, []);

  const matchesInViewport = useMemo<MatchWithDistance[]>(() => {
    if (visibleMatchIds === null) return [];

    return filteredMatches
      .filter((m) => visibleMatchIds.includes(m.id))
      .map((match) => ({
        match,
        distance: distanceKm(userPosition, match.location),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [filteredMatches, visibleMatchIds, userPosition]);

  const displayed = useMemo(() => {
    if (selectedId) {
      const found = matchesInViewport.find((m) => m.match.id === selectedId);
      if (found) return [found];
      const selected = filteredMatches.find((m) => m.id === selectedId);
      if (selected) {
        return [{ match: selected, distance: distanceKm(userPosition, selected.location) }];
      }
      return matchesInViewport;
    }
    return matchesInViewport;
  }, [matchesInViewport, selectedId, filteredMatches, userPosition]);

  const emptyMessage =
    formatFilter === 'all'
      ? 'Aucun match à venir dans cette zone. Déplace ou zoome la carte pour explorer.'
      : `Aucun match ${formatFilter}v${formatFilter} dans cette zone. Change de filtre ou explore la carte.`;

  return (
    <View style={styles.container}>
      <MatchMapView
        matches={filteredMatches}
        selectedId={selectedId}
        center={userPosition}
        onSelectMatch={setSelectedId}
        onViewportChange={handleViewportChange}
      />

      <View style={styles.listOverlay}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterBar}
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

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {selectedId ? 'Match sélectionné' : 'Dans cette zone'}
          </Text>
          <Pressable onPress={refreshLocation} style={styles.locateBtn} disabled={locating}>
            {locating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="navigate" size={20} color={Colors.primary} />
            )}
          </Pressable>
        </View>
        {displayed.length === 0 ? (
          <Text style={styles.empty}>{emptyMessage}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {displayed.map(({ match, distance }) => (
              <View key={match.id} style={styles.cardWrap}>
                <NearbyMatchCard
                  match={match}
                  distance={distance}
                  onPress={() => router.push(`/match/${match.id}`)}
                />
              </View>
            ))}
          </ScrollView>
        )}
        {selectedId && (
          <Pressable onPress={() => setSelectedId(null)}>
            <Text style={styles.resetHint}>Voir toute la zone</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    maxHeight: '50%',
  },
  filterBar: {
    marginBottom: Spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listTitle: {
    ...Typography.h3,
    color: Colors.text,
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  locateBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    ...Typography.body,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  cardWrap: { width: 320, paddingLeft: Spacing.xxl },
  resetHint: {
    ...Typography.caption,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
});
