import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { KojiroLogo } from '@/components/ui/KojiroLogo';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { handleAuthDeepLink } from '@/lib/authDeepLink';
import { useAuthStore } from '@/store/authStore';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();
  const { updatePassword, isLoading, isPasswordRecovery, clearPasswordRecovery } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [awaitingRecovery, setAwaitingRecovery] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (typeof params.code === 'string' && params.code.length > 0) {
        await handleAuthDeepLink(`kojiro://reset-password?code=${encodeURIComponent(params.code)}`);
      }
      // Give onAuthStateChange a moment to set isPasswordRecovery
      await new Promise((r) => setTimeout(r, 400));
      if (!cancelled) setAwaitingRecovery(false);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [params.code]);

  useEffect(() => {
    if (isPasswordRecovery) setAwaitingRecovery(false);
  }, [isPasswordRecovery]);

  const handleSubmit = async () => {
    if (!password || !confirm) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    try {
      await updatePassword(password);
      Alert.alert('Mot de passe mis à jour', 'Tu es maintenant connecté.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e) {
      Alert.alert(
        'Mise à jour impossible',
        e instanceof Error ? e.message : 'Erreur inconnue'
      );
    }
  };

  if (awaitingRecovery) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isPasswordRecovery) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={() => {
            clearPasswordRecovery();
            router.replace('/(auth)/login');
          }}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <ScrollView contentContainerStyle={styles.scroll}>
          <KojiroLogo size={96} style={styles.logo} />
          <Text style={styles.title}>Lien invalide</Text>
          <Text style={styles.subtitle}>
            Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demande-en un nouveau.
          </Text>
          <Button
            title="Mot de passe oublié"
            onPress={() => router.replace('/(auth)/forgot-password')}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <KojiroLogo size={96} style={styles.logo} />
        <Text style={styles.title}>Nouveau mot de passe</Text>
        <Text style={styles.subtitle}>Choisis un mot de passe d’au moins 6 caractères</Text>

        <Input
          label="Nouveau mot de passe"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          icon="lock-closed-outline"
        />
        <Input
          label="Confirmer le mot de passe"
          placeholder="••••••••"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          icon="lock-closed-outline"
        />

        <Button
          title="Enregistrer"
          onPress={handleSubmit}
          loading={isLoading}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    padding: Spacing.lg,
  },
  scroll: {
    padding: Spacing.xxl,
    paddingTop: Spacing.lg,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxxl,
  },
});
