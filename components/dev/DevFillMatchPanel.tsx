import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { devFillMatchAttendees } from '@/services/dev';
import { Match } from '@/types';
import { countPresentAttendees } from '@/utils/matchAttendance';

interface DevFillMatchPanelProps {
  match: Match;
  onFilled: () => Promise<void>;
}

export function DevFillMatchPanel({ match, onFilled }: DevFillMatchPanelProps) {
  const presentCount = countPresentAttendees(match.attendees);
  const [target, setTarget] = useState(String(match.maxPlayers));
  const [loading, setLoading] = useState(false);

  const handleFill = async () => {
    const parsed = parseInt(target, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      Alert.alert('Nombre invalide', 'Indique un nombre de joueurs présents souhaité (ex. 14).');
      return;
    }

    const clamped = Math.min(parsed, match.maxPlayers);

    Alert.alert(
      'Remplir le match (dev)',
      `Inscrire des comptes démo (anouar+1@bhgroupe.fr…) jusqu'à ${clamped} présents ?\n\nActuellement : ${presentCount}/${match.maxPlayers}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await devFillMatchAttendees(match.id, clamped);
              await onFilled();
              Alert.alert(
                'Joueurs ajoutés',
                `${result.message}\n\nPrésents : ${result.present}/${match.maxPlayers}`
              );
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec du remplissage');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const quickFill = (count: number) => {
    setTarget(String(Math.min(count, match.maxPlayers)));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.badge}>DEV</Text>
      <Text style={styles.title}>Remplir le match (test)</Text>
      <Text style={styles.hint}>
        Inscrit automatiquement les comptes démo comme « Présent », sans te reconnecter sur
        chaque compte. Lance d'abord : node scripts/seed-demo-users.mjs
      </Text>

      <Text style={styles.status}>
        Présents : {presentCount}/{match.maxPlayers}
      </Text>

      <Input
        label="Nombre de présents visés"
        value={target}
        onChangeText={setTarget}
        keyboardType="number-pad"
        icon="people-outline"
        placeholder={String(match.maxPlayers)}
      />

      <View style={styles.presets}>
        <Button title="Complet" onPress={() => quickFill(match.maxPlayers)} variant="outline" size="sm" />
        <Button title="10" onPress={() => quickFill(10)} variant="outline" size="sm" />
        <Button title="6" onPress={() => quickFill(6)} variant="outline" size="sm" />
      </View>

      <Button
        title="Inscrire les joueurs démo"
        onPress={handleFill}
        loading={loading}
        icon="flash-outline"
        fullWidth
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderStyle: 'dashed',
    backgroundColor: `${Colors.warning}12`,
  },
  badge: {
    alignSelf: 'flex-start',
    ...Typography.small,
    color: Colors.warning,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.bodyBold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  status: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  presets: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
});
