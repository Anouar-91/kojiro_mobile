import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LocationPicker } from '@/components/ui/LocationPicker';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { uploadAvatar } from '@/services/storage';
import { useAuthStore } from '@/store/authStore';
import { Foot, Position } from '@/types';
import { GeoPlace } from '@/types/geo';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [cityPlace, setCityPlace] = useState<GeoPlace | null>(
    user?.latitude != null && user?.longitude != null
      ? {
          name: user.city,
          address: user.city,
          latitude: user.latitude,
          longitude: user.longitude,
          city: user.city,
        }
      : user?.city
        ? { name: user.city, address: user.city, latitude: 0, longitude: 0, city: user.city }
        : null
  );
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [position, setPosition] = useState<Position>(user?.position ?? 'MID');
  const [foot, setFoot] = useState<Foot>(user?.foot ?? 'Droit');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission refusée', 'Autorise l\'accès à la galerie pour changer ta photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, result.assets[0].uri);
      setAvatar(url);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Upload impossible');
    } finally {
      setUploading(false);
    }
  };

  const handleCityChange = (place: GeoPlace | null) => {
    setCityPlace(place);
  };

  const handleSave = async () => {
    if (
      !cityPlace ||
      cityPlace.latitude == null ||
      cityPlace.longitude == null ||
      (cityPlace.latitude === 0 && cityPlace.longitude === 0)
    ) {
      Alert.alert('Ville requise', 'Sélectionne ta ville dans la liste de suggestions.');
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        name,
        bio,
        city: cityPlace.city ?? cityPlace.name,
        latitude: cityPlace.latitude,
        longitude: cityPlace.longitude,
        position,
        foot,
        avatar,
      });
      Alert.alert('Profil mis à jour', 'Tes modifications ont été enregistrées.');
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.avatarWrap} onPress={pickAvatar} disabled={uploading}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={40} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.avatarEdit}>
          <Ionicons name="camera" size={16} color={Colors.background} />
        </View>
        {uploading && <Text style={styles.uploading}>Upload...</Text>}
      </Pressable>
      <Input label="Nom complet" value={name} onChangeText={setName} icon="person-outline" />

      <LocationPicker
        label="Ville"
        placeholder="Paris, Lyon, Marseille..."
        value={cityPlace?.latitude != null && cityPlace.longitude != null ? cityPlace : null}
        onChange={handleCityChange}
        mode="city"
        showCurrentLocation
      />

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

      <Button title="Enregistrer" onPress={handleSave} loading={saving} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  avatarWrap: { alignSelf: 'center', marginBottom: Spacing.xxl, position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surfaceElevated },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploading: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
});
