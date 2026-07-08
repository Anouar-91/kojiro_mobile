import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { createSocialPost } from '@/services/social';
import { uploadHighlightMedia } from '@/services/storage';
import { useAuthStore } from '@/store/authStore';

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>('image/jpeg');
  const [isVideo, setIsVideo] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    quality: 0.8,
    videoMaxDuration: 30,
    ...(Platform.OS === 'ios' && {
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    }),
  };

  const pickMedia = async (fromCamera: boolean) => {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission refusée', 'Autorise l\'accès à la caméra ou à la galerie.');
        return;
      }

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'));
      setIsVideo(asset.type === 'video');
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d\'ouvrir la galerie ou la caméra.'
      );
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    if (!content.trim()) {
      Alert.alert('Erreur', 'Ajoute une légende à ton highlight.');
      return;
    }

    setLoading(true);
    try {
      let mediaUrl: string | undefined;
      if (mediaUri) {
        mediaUrl = await uploadHighlightMedia(user.id, mediaUri, mediaType);
      }

      await createSocialPost({
        authorId: user.id,
        type: isVideo ? 'video' : mediaUri ? 'photo' : 'result',
        content: content.trim(),
        mediaUrl,
      });

      Alert.alert('Publié !', 'Ton highlight est en ligne.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Publication impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Nouveau highlight</Text>
        <Text style={styles.subtitle}>Partage un moment fort de ton match</Text>

        {mediaUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: mediaUri }} style={styles.preview} />
            {isVideo && (
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={16} color={Colors.text} />
                <Text style={styles.videoBadgeText}>Vidéo</Text>
              </View>
            )}
            <Pressable style={styles.removeMedia} onPress={() => setMediaUri(null)}>
              <Ionicons name="close-circle" size={28} color={Colors.error} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.mediaActions}>
            <Pressable style={styles.mediaBtn} onPress={() => pickMedia(true)}>
              <Ionicons name="camera" size={28} color={Colors.primary} />
              <Text style={styles.mediaBtnText}>Caméra</Text>
            </Pressable>
            <Pressable style={styles.mediaBtn} onPress={() => pickMedia(false)}>
              <Ionicons name="images" size={28} color={Colors.primary} />
              <Text style={styles.mediaBtnText}>Galerie</Text>
            </Pressable>
          </View>
        )}

        <Input
          label="Légende"
          placeholder="But incroyable, passe décisive..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={3}
        />

        <Button
          title="Publier"
          onPress={handlePublish}
          loading={loading}
          fullWidth
          size="lg"
          icon="send-outline"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl },
  title: { ...Typography.h2, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.xxl },
  mediaActions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xxl },
  mediaBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xxl,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  mediaBtnText: { ...Typography.caption, color: Colors.textSecondary },
  previewWrap: { position: 'relative', marginBottom: Spacing.xxl },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: Colors.surfaceElevated },
  removeMedia: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
  videoBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  videoBadgeText: { ...Typography.small, color: Colors.text },
});
