import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { NearbyMatchCard } from '@/components/home/MatchCards';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useMatchStore } from '@/store/matchStore';

const PARIS_REGION = {
  latitude: 48.8566,
  longitude: 2.3522,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const router = useRouter();
  const matches = useMatchStore((s) => s.matches.filter((m) => m.status === 'upcoming'));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={PARIS_REGION}
        customMapStyle={darkMapStyle}
        userInterfaceStyle="dark"
        showsUserLocation
      >
        {matches.map((match) => (
          <Marker
            key={match.id}
            coordinate={{
              latitude: match.location.latitude,
              longitude: match.location.longitude,
            }}
            onPress={() => setSelectedId(match.id)}
          >
            <View style={[styles.marker, selectedId === match.id && styles.markerSelected]}>
              <Text style={styles.markerText}>{match.format}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

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

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  marker: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  markerSelected: {
    backgroundColor: Colors.info,
    transform: [{ scale: 1.2 }],
  },
  markerText: {
    ...Typography.small,
    color: Colors.background,
    fontWeight: '800',
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
  },
  listTitle: {
    ...Typography.h3,
    color: Colors.text,
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  cardWrap: { width: 320, paddingLeft: Spacing.xxl },
});
