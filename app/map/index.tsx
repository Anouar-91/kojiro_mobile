import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NearbyMatchCard } from '@/components/home/MatchCards';
import { MatchMapView } from '@/components/map/MatchMapView';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useMatchStore } from '@/store/matchStore';

export default function MapScreen() {
  const router = useRouter();
  const matches = useMatchStore((s) => s.matches.filter((m) => m.status === 'upcoming'));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <MatchMapView
        matches={matches}
        selectedId={selectedId}
        onSelectMatch={setSelectedId}
      />

      <View style={styles.listOverlay}>
        <Text style={styles.listTitle}>Matchs à proximité</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {matches.map((match, i) => (
            <View key={match.id} style={styles.cardWrap}>
              <NearbyMatchCard
                match={match}
                distance={0.8 + i * 0.6}
                onPress={() => router.push(`/match/${match.id}`)}
              />
            </View>
          ))}
        </ScrollView>
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
  cardWrap: { width: 320, paddingLeft: Spacing.xxl },
});
