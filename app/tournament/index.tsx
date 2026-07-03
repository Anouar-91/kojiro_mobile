import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { createNotification } from '@/services/notifications';
import {
  fetchTournaments,
  fetchUserRegistrations,
  registerForTournament,
} from '@/services/tournaments';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { Tournament } from '@/types';
import { formatShortDate, getFormatLabel } from '@/utils/formatters';

export default function TournamentScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchNotifications = useMatchStore((s) => s.fetchNotifications);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTournaments();
      setTournaments(data);
      if (user) {
        const ids = await fetchUserRegistrations(user.id);
        setRegisteredIds(new Set(ids));
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de charger les tournois');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegister = async (tournament: Tournament) => {
    if (!user) return;
    setRegisteringId(tournament.id);
    try {
      await registerForTournament(tournament.id, user.id);
      setRegisteredIds((prev) => new Set(prev).add(tournament.id));
      await createNotification(user.id, {
        type: 'tournament',
        title: 'Inscription confirmée',
        body: `Tu es inscrit au ${tournament.name}`,
        data: { tournamentId: tournament.id },
      });
      await fetchNotifications(user.id);
      await load();
      Alert.alert('Inscription réussie', `À bientôt au ${tournament.name} !`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Inscription impossible');
    } finally {
      setRegisteringId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {tournaments.length === 0 ? (
        <Text style={styles.empty}>Aucun tournoi disponible pour le moment.</Text>
      ) : (
        tournaments.map((tournament) => {
          const isRegistered = registeredIds.has(tournament.id);
          const isFull = tournament.registeredTeams >= tournament.maxTeams;

          return (
            <View key={tournament.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Badge
                  label={
                    tournament.status === 'registration'
                      ? 'Inscriptions'
                      : tournament.status === 'ongoing'
                        ? 'En cours'
                        : 'Terminé'
                  }
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
                isRegistered ? (
                  <Badge label="Inscrit ✓" variant="success" size="md" style={styles.registeredBadge} />
                ) : (
                  <Button
                    title={isFull ? 'Complet' : "S'inscrire"}
                    onPress={() => handleRegister(tournament)}
                    fullWidth
                    style={styles.btn}
                    disabled={isFull}
                    loading={registeringId === tournament.id}
                  />
                )
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  empty: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxxl },
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
  registeredBadge: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
});
