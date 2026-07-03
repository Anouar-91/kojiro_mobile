import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AttendanceActions, AttendanceSection } from '@/components/match/PlayerComponents';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { getUserById } from '@/data/mock';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { AttendanceStatus } from '@/types';
import { formatMatchDate, formatPrice, getFormatLabel } from '@/utils/formatters';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const updateAttendance = useMatchStore((s) => s.updateAttendance);

  if (!match) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Match introuvable</Text>
      </View>
    );
  }

  const present = match.attendees.filter((a) => a.status === 'present');
  const maybe = match.attendees.filter((a) => a.status === 'maybe');
  const absent = match.attendees.filter((a) => a.status === 'absent');

  const presentUsers = present.map((a) => getUserById(a.userId)).filter(Boolean) as NonNullable<ReturnType<typeof getUserById>>[];
  const maybeUsers = maybe.map((a) => getUserById(a.userId)).filter(Boolean) as NonNullable<ReturnType<typeof getUserById>>[];
  const absentUsers = absent.map((a) => getUserById(a.userId)).filter(Boolean) as NonNullable<ReturnType<typeof getUserById>>[];

  const myAttendance = match.attendees.find((a) => a.userId === user?.id)?.status ?? 'pending';

  const handleStatusChange = (status: AttendanceStatus) => {
    if (user) updateAttendance(match.id, user.id, status);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {match.imageUrl && (
        <Image source={{ uri: match.imageUrl }} style={styles.hero} contentFit="cover" />
      )}

      <View style={styles.header}>
        <Text style={styles.format}>{getFormatLabel(match.format)}</Text>
        <Text style={styles.title}>{match.title}</Text>
        <Text style={styles.date}>{formatMatchDate(match.date, match.time)}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location" size={18} color={Colors.primary} />
          <View>
            <Text style={styles.locationName}>{match.location.name}</Text>
            <Text style={styles.locationAddress}>{match.location.address}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatPrice(match.pricePerPlayer)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>{present.length}/{match.maxPlayers} joueurs</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ma présence</Text>
        <AttendanceActions currentStatus={myAttendance} onStatusChange={handleStatusChange} />
        <ProgressBar
          progress={present.length / match.maxPlayers}
          label={`${present.length}/${match.maxPlayers} confirmés`}
          showLabel
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Participants</Text>
        <AttendanceSection title="Présents" users={presentUsers} statusColor={Colors.success} />
        <AttendanceSection title="Peut-être" users={maybeUsers} statusColor={Colors.warning} />
        <AttendanceSection title="Absents" users={absentUsers} statusColor={Colors.error} />
      </View>

      {match.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{match.description}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title="Composer les équipes"
          onPress={() => router.push({ pathname: '/match/teams', params: { id: match.id } })}
          icon="shuffle-outline"
          fullWidth
        />
        <Button
          title="Chat du match"
          onPress={() => router.push({ pathname: '/match/chat', params: { id: match.id } })}
          variant="secondary"
          icon="chatbubbles-outline"
          fullWidth
        />
        <Button
          title="Inviter des joueurs"
          onPress={() => {}}
          variant="outline"
          icon="person-add-outline"
          fullWidth
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xxxl },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  notFoundText: { ...Typography.body, color: Colors.textMuted },
  hero: { width: '100%', height: 180 },
  header: { padding: Spacing.xxl },
  format: { ...Typography.caption, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase' },
  title: { ...Typography.h2, color: Colors.text, marginTop: Spacing.xs },
  date: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.xs },
  locationRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, alignItems: 'flex-start' },
  locationName: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
  locationAddress: { ...Typography.caption, color: Colors.textMuted },
  metaRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...Typography.caption, color: Colors.textSecondary },
  section: { paddingHorizontal: Spacing.xxl, marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.md },
  description: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  actions: { paddingHorizontal: Spacing.xxl, gap: Spacing.md },
});
