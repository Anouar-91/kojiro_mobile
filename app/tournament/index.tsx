import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { mockTournaments } from '@/data/mock';
import { formatShortDate, getFormatLabel } from '@/utils/formatters';

export default function TournamentScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {mockTournaments.map((tournament) => (
        <View key={tournament.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Badge
              label={tournament.status === 'registration' ? 'Inscriptions' : tournament.status === 'ongoing' ? 'En cours' : 'Terminé'}
              variant={tournament.status === 'ongoing' ? 'success' : 'primary'}
            />
            <Text style={styles.format}>{getFormatLabel(tournament.format)}</Text>
          </View>
          <Text style={styles.title}>{tournament.name}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              {formatShortDate(tournament.startDate)} - {formatShortDate(tournament.endDate)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>{tournament.location.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              {tournament.registeredTeams}/{tournament.maxTeams} équipes
            </Text>
          </View>
          {tournament.prize && (
            <View style={styles.prizeRow}>
              <Ionicons name="trophy" size={16} color={Colors.gold} />
              <Text style={styles.prizeText}>{tournament.prize}</Text>
            </View>
          )}
          {tournament.status === 'registration' && (
            <Button title="S'inscrire" onPress={() => {}} fullWidth style={styles.btn} />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  format: { ...Typography.caption, color: Colors.textMuted },
  title: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  infoText: { ...Typography.caption, color: Colors.textSecondary },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.md },
  prizeText: { ...Typography.bodyBold, color: Colors.gold, fontSize: 14 },
  btn: { marginTop: Spacing.sm },
});
