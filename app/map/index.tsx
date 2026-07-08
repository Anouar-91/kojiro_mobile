import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NearbyMatchCard } from '@/components/home/MatchCards';
import { MatchMapView } from '@/components/map/MatchMapView';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useMatchStore } from '@/store/matchStore';
import { Match } from '@/types';
import { distanceKm } from '@/utils/geo';

interface MatchWithDistance {
  match: Match;
  distance: number;
}

export default function MapScreen() {
  const router = useRouter();
  const allMatches = useMatchStore((s) => s.matches);
  const { position: userPosition, loading: locating, refresh: refreshLocation } = useCurrentLocation();

  const matchesWithDistance = useMemo<MatchWithDistance[]>(() => {
    return allMatches
      .filter((m) => m.status === 'upcoming')
      .map((match) => ({
        match,
        distance: distanceKm(userPosition, match.location),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [allMatches, userPosition]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const displayed = useMemo(() => {
    if (selectedId) {
      const found = matchesWithDistance.find((m) => m.match.id === selectedId);
      return found ? [found] : matchesWithDistance;
    }
    return matchesWithDistance;
  }, [matchesWithDistance, selectedId]);

  return (
    <View style={styles.container}>
      <MatchMapView
        matches={matchesWithDistance.map((m) => m.match)}
        selectedId={selectedId}
        center={userPosition}
        onSelectMatch={setSelectedId}
      />

      <View style={styles.listOverlay}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {selectedId ? 'Match sélectionné' : 'Matchs à proximité'}
          </Text>
          <Pressable onPress={refreshLocation} style={styles.locateBtn} disabled={locating}>
            {locating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="navigate" size={20} color={Colors.primary} />
            )}
          </Pressable>
        </View>
        {matchesWithDistance.length === 0 ? (
          <Text style={styles.empty}>Aucun match à venir avec une position connue.</Text>
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
            <Text style={styles.resetHint}>Voir tous les matchs</Text>
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
    maxHeight: '45%',
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
