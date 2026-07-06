import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NearbyMatchCard } from '@/components/home/MatchCards';
import { MatchMapView } from '@/components/map/MatchMapView';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { Match } from '@/types';
import { distanceKm, getUserPosition } from '@/utils/geo';

interface MatchWithDistance {
  match: Match;
  distance: number;
}

export default function MapScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allMatches = useMatchStore((s) => s.matches);
  const userPosition = useMemo(() => getUserPosition(user ?? undefined), [user]);

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
        <Text style={styles.listTitle}>
          {selectedId ? 'Match sélectionné' : 'Matchs à proximité'}
        </Text>
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
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
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
