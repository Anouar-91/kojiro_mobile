import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LocationPicker } from '@/components/ui/LocationPicker';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { MATCH_FORMAT_PRESETS, SUBSTITUTE_PRESETS, MatchVisibility } from '@/types';
import { GeoPlace } from '@/types/geo';
import {
  clampPlayersPerTeam,
  clampSubstitutesPerTeam,
  getFormatLabel,
  getMatchFormatDescription,
  getMaxPlayers,
} from '@/utils/formatters';

export default function CreateMatchScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const createMatch = useMatchStore((s) => s.createMatch);

  const [playersPerTeam, setPlayersPerTeam] = useState(7);
  const [substitutesPerTeam, setSubstitutesPerTeam] = useState(0);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-07-10');
  const [time, setTime] = useState('19:00');
  const [location, setLocation] = useState<GeoPlace | null>(null);
  const [price, setPrice] = useState('8');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<MatchVisibility>('public');
  const [loading, setLoading] = useState(false);

  const maxPlayers = useMemo(
    () => getMaxPlayers(playersPerTeam, substitutesPerTeam),
    [playersPerTeam, substitutesPerTeam]
  );
  const formatLabel = useMemo(
    () => getMatchFormatDescription(playersPerTeam, substitutesPerTeam),
    [playersPerTeam, substitutesPerTeam]
  );

  const adjustPlayers = (delta: number) => {
    setPlayersPerTeam((prev) => clampPlayersPerTeam(prev + delta));
  };

  const handleCreate = async () => {
    if (!location) {
      Alert.alert('Erreur', 'Sélectionne un lieu dans la liste ou utilise ta position GPS.');
      return;
    }
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }
    setLoading(true);
    try {
      const match = await createMatch(
        {
          title: title.trim() || `Foot ${formatLabel}`,
          format: playersPerTeam,
          substitutesPerTeam,
          date,
          time,
          locationName: location.name,
          locationAddress: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          pricePerPlayer: parseFloat(price) || 0,
          description,
          visibility,
        },
        user.id
      );
      router.replace(`/match/${match.id}`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de créer le match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Format du match</Text>
          <Text style={styles.sectionHint}>Nombre de joueurs par équipe</Text>

          <ChipGroup
            options={MATCH_FORMAT_PRESETS.map((n) => ({
              label: `${n}v${n}`,
              value: n,
            }))}
            selected={playersPerTeam}
            onSelect={(v) => setPlayersPerTeam(clampPlayersPerTeam(Number(v)))}
          />

          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => adjustPlayers(-1)}
              disabled={playersPerTeam <= 2}
            >
              <Ionicons name="remove" size={22} color={playersPerTeam <= 2 ? Colors.textMuted : Colors.text} />
            </Pressable>

            <View style={styles.stepperValue}>
              <Text style={styles.stepperNumber}>{playersPerTeam}</Text>
              <Text style={styles.stepperUnit}>joueurs / équipe</Text>
            </View>

            <Pressable
              style={styles.stepperBtn}
              onPress={() => adjustPlayers(1)}
              disabled={playersPerTeam >= 15}
            >
              <Ionicons name="add" size={22} color={playersPerTeam >= 15 ? Colors.textMuted : Colors.text} />
            </Pressable>
          </View>

          <Text style={styles.formatPreview}>
            {formatLabel} · {maxPlayers} places au total
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Remplaçants</Text>
          <Text style={styles.sectionHint}>Par équipe, en plus des titulaires</Text>

          <ChipGroup
            options={SUBSTITUTE_PRESETS.map((n) => ({
              label: n === 0 ? 'Aucun' : `${n} remp.`,
              value: n,
            }))}
            selected={substitutesPerTeam}
            onSelect={(v) => setSubstitutesPerTeam(clampSubstitutesPerTeam(Number(v)))}
          />

          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => setSubstitutesPerTeam((p) => clampSubstitutesPerTeam(p - 1))}
              disabled={substitutesPerTeam <= 0}
            >
              <Ionicons name="remove" size={22} color={substitutesPerTeam <= 0 ? Colors.textMuted : Colors.text} />
            </Pressable>

            <View style={styles.stepperValue}>
              <Text style={styles.stepperNumber}>{substitutesPerTeam}</Text>
              <Text style={styles.stepperUnit}>remplaçants / équipe</Text>
            </View>

            <Pressable
              style={styles.stepperBtn}
              onPress={() => setSubstitutesPerTeam((p) => clampSubstitutesPerTeam(p + 1))}
              disabled={substitutesPerTeam >= 10}
            >
              <Ionicons name="add" size={22} color={substitutesPerTeam >= 10 ? Colors.textMuted : Colors.text} />
            </Pressable>
          </View>

          {substitutesPerTeam > 0 && (
            <Text style={styles.subHint}>
              {playersPerTeam} titulaires + {substitutesPerTeam} remp. par équipe
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Qui peut rejoindre ?</Text>
          <ChipGroup
            options={[
              { label: 'Ouvert à tous', value: 'public' },
              { label: 'Entre amis', value: 'friends_only' },
            ]}
            selected={visibility}
            onSelect={(v) => setVisibility(v as MatchVisibility)}
          />
          <Text style={styles.sectionHint}>
            {visibility === 'friends_only'
              ? 'Seuls tes amis verront et pourront rejoindre ce match.'
              : 'Tous les joueurs Kojiro peuvent voir et rejoindre ce match.'}
          </Text>
        </View>

        <Input
          label="Nom du match (optionnel)"
          placeholder={`Ex: Foot ${getFormatLabel(playersPerTeam)} du jeudi`}
          value={title}
          onChangeText={setTitle}
          icon="football-outline"
        />
        <Input label="Date" placeholder="2026-07-10" value={date} onChangeText={setDate} icon="calendar-outline" />
        <Input label="Heure" placeholder="19:00" value={time} onChangeText={setTime} icon="time-outline" />

        <LocationPicker
          label="Lieu du match"
          placeholder="Ex: City Stade Paris 13 ou 45 Rue du Charolais, Paris"
          value={location}
          onChange={setLocation}
          mode="venue"
          showCurrentLocation
        />

        <Input label="Prix par joueur (€)" placeholder="8" value={price} onChangeText={setPrice} keyboardType="numeric" icon="cash-outline" />
        <Input
          label="Description"
          placeholder="Infos complémentaires..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Button title="Créer le match" onPress={handleCreate} loading={loading} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  sectionHint: {
    ...Typography.small,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { alignItems: 'center', minWidth: 120 },
  stepperNumber: { ...Typography.h1, color: Colors.primary },
  stepperUnit: { ...Typography.caption, color: Colors.textMuted },
  formatPreview: {
    ...Typography.bodyBold,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  subHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
