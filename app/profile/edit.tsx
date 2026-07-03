import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { Foot, Position } from '@/types';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [position, setPosition] = useState<Position>(user?.position ?? 'MID');
  const [foot, setFoot] = useState<Foot>(user?.foot ?? 'Droit');

  const handleSave = () => {
    updateUser({ name, bio, city, position, foot });
    Alert.alert('Profil mis à jour', 'Tes modifications ont été enregistrées.');
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input label="Nom complet" value={name} onChangeText={setName} icon="person-outline" />
      <Input label="Ville" value={city} onChangeText={setCity} icon="location-outline" />
      <Input label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />

      <Input label="Poste" editable={false} value="" />
      <ChipGroup
        options={[
          { label: 'Gardien', value: 'GK' },
          { label: 'Défenseur', value: 'DEF' },
          { label: 'Milieu', value: 'MID' },
          { label: 'Attaquant', value: 'FWD' },
        ]}
        selected={position}
        onSelect={(v) => setPosition(v as Position)}
      />

      <Input label="Pied fort" editable={false} value="" />
      <ChipGroup
        options={[
          { label: 'Gauche', value: 'Gauche' },
          { label: 'Droit', value: 'Droit' },
          { label: 'Ambidextre', value: 'Ambidextre' },
        ]}
        selected={foot}
        onSelect={(v) => setFoot(v as Foot)}
      />

      <Button title="Enregistrer" onPress={handleSave} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
});
