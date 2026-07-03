import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { MatchFormat } from '@/types';

export default function CreateMatchScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const createMatch = useMatchStore((s) => s.createMatch);

  const [format, setFormat] = useState<MatchFormat>(7);
  const [date, setDate] = useState('2026-07-10');
  const [time, setTime] = useState('19:00');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [price, setPrice] = useState('8');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!locationName) {
      Alert.alert('Erreur', 'Veuillez indiquer un lieu');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const match = createMatch(
      {
        title: `Foot à ${format}`,
        format,
        date,
        time,
        locationName,
        locationAddress: locationAddress || locationName,
        latitude: 48.8566,
        longitude: 2.3522,
        pricePerPlayer: parseFloat(price) || 0,
        description,
      },
      user?.id ?? 'user-1'
    );

    setLoading(false);
    router.replace(`/match/${match.id}`);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Input label="Type de match" editable={false} value="" />
          <ChipGroup
            options={[
              { label: '5v5', value: 5 },
              { label: '7v7', value: 7 },
              { label: '11v11', value: 11 },
            ]}
            selected={format}
            onSelect={(v) => setFormat(v as MatchFormat)}
          />
        </View>

        <Input label="Date" placeholder="2026-07-10" value={date} onChangeText={setDate} icon="calendar-outline" />
        <Input label="Heure" placeholder="19:00" value={time} onChangeText={setTime} icon="time-outline" />
        <Input label="Lieu" placeholder="City Stade Paris 13" value={locationName} onChangeText={setLocationName} icon="location-outline" />
        <Input label="Adresse" placeholder="45 Rue du Charolais, Paris" value={locationAddress} onChangeText={setLocationAddress} icon="map-outline" />
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
  section: { marginBottom: Spacing.sm },
});
