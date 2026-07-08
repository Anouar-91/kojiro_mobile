import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AvatarGroup } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useProfileStore } from '@/store/profileStore';
import { Match } from '@/types';
import { formatShortDate, getMatchFormatDescription } from '@/utils/formatters';
import { isMatchFull } from '@/utils/matchAttendance';

interface UpcomingMatchCardProps {
  match: Match;
  onPress: () => void;
}

export function UpcomingMatchCard({ match, onPress }: UpcomingMatchCardProps) {
  const getProfile = useProfileStore((s) => s.getProfile);
  const presentCount = match.attendees.filter((a) => a.status === 'present').length;
  const full = isMatchFull(match);
  const avatars = match.attendees
    .filter((a) => a.status === 'present')
    .slice(0, 5)
    .map((a) => getProfile(a.userId)?.avatar ?? '');

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badges}>
          <Badge label={getMatchFormatDescription(match.format, match.substitutesPerTeam)} variant="primary" />
          {full && <Badge label="Complet" variant="secondary" />}
        </View>
        <Text style={styles.date}>{formatShortDate(match.date)} · {match.time}</Text>
      </View>
      <Text style={styles.title}>{match.title}</Text>
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.location} numberOfLines={1}>{match.location.name}</Text>
      </View>
      <View style={styles.footer}>
        <AvatarGroup uris={avatars} size={26} />
        <Text style={styles.count}>{presentCount}/{match.maxPlayers}</Text>
      </View>
      <ProgressBar progress={presentCount / match.maxPlayers} height={4} />
    </Card>
  );
}

interface NearbyMatchCardProps {
  match: Match;
  distance: number;
  onPress: () => void;
}

export function NearbyMatchCard({ match, distance, onPress }: NearbyMatchCardProps) {
  const presentCount = match.attendees.filter((a) => a.status === 'present').length;

  return (
    <Card onPress={onPress} style={styles.nearbyCard} padding={0}>
      <Image
        source={{ uri: match.imageUrl ?? 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=400' }}
        style={styles.image}
        contentFit="cover"
      />
      <View style={styles.nearbyContent}>
        <View style={styles.nearbyHeader}>
          <Badge label={getMatchFormatDescription(match.format, match.substitutesPerTeam)} />
          <Text style={styles.distance}>{distance.toFixed(1)} km</Text>
        </View>
        <Text style={styles.nearbyTitle} numberOfLines={1}>{match.location.name}</Text>
        <Text style={styles.nearbyMeta}>{match.time} · {presentCount}/{match.maxPlayers} joueurs</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  date: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  title: {
    ...Typography.bodyBold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  location: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  count: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
  nearbyCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  image: {
    width: 90,
    height: 90,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  nearbyContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'center',
  },
  nearbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distance: {
    ...Typography.small,
    color: Colors.info,
    fontWeight: '600',
  },
  nearbyTitle: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 14,
  },
  nearbyMeta: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
