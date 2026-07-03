import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TeamColumn } from '@/components/match/PlayerComponents';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getPresentUsersFromMatch, useProfileStore } from '@/store/profileStore';
import { useMatchStore } from '@/store/matchStore';
import { balanceTeams, BalancedTeams } from '@/utils/teamBalancer';

export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const getProfile = useProfileStore((s) => s.getProfile);
  const [teams, setTeams] = useState<BalancedTeams>({ teamA: [], teamB: [], averageA: 0, averageB: 0 });

  const rebalance = useCallback(() => {
    if (!match) return;
    const players = getPresentUsersFromMatch(match, getProfile);
    setTeams(balanceTeams(players));
  }, [match, getProfile]);

  useEffect(() => {
    rebalance();
  }, [rebalance]);

  if (!match) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Match introuvable</Text>
      </View>
    );
  }

  const playerCount = getPresentUsersFromMatch(match, getProfile).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.aiHeader}>
        <Text style={styles.aiIcon}>🤖</Text>
        <View style={styles.aiInfo}>
          <Text style={styles.aiTitle}>Équilibrage IA</Text>
          <Text style={styles.aiDesc}>
            Les équipes sont équilibrées selon le niveau, le poste et les statistiques de chaque joueur.
          </Text>
        </View>
      </View>

      {playerCount < 2 ? (
        <Text style={styles.empty}>
          Il faut au moins 2 joueurs confirmés pour composer les équipes.
        </Text>
      ) : (
        <>
          <View style={styles.teamsRow}>
            <TeamColumn
              title="Équipe A"
              players={teams.teamA.map((p) => p.user)}
              averageLevel={teams.averageA}
              color={Colors.primary}
            />
            <View style={styles.vs}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            <TeamColumn
              title="Équipe B"
              players={teams.teamB.map((p) => p.user)}
              averageLevel={teams.averageB}
              color={Colors.info}
            />
          </View>

          <View style={styles.balanceInfo}>
            <Text style={styles.balanceText}>
              Écart de niveau : {Math.abs(teams.averageA - teams.averageB)} pts
              {Math.abs(teams.averageA - teams.averageB) <= 3 ? ' ✓ Équilibré' : ''}
            </Text>
          </View>
        </>
      )}

      <View style={styles.actions}>
        <Button title="Rééquilibrer" onPress={rebalance} variant="outline" icon="shuffle-outline" fullWidth />
        <Button title="Valider les équipes" onPress={() => {}} fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: Colors.textMuted },
  empty: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.xl },
  aiHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: Spacing.md,
  },
  aiIcon: { fontSize: 32 },
  aiInfo: { flex: 1 },
  aiTitle: { ...Typography.bodyBold, color: Colors.primary },
  aiDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  teamsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  vs: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  vsText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '800' },
  balanceInfo: { alignItems: 'center', marginBottom: Spacing.xl },
  balanceText: { ...Typography.caption, color: Colors.textSecondary },
  actions: { gap: Spacing.md },
});
