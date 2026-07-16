import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KojiroLogo } from '@/components/ui/KojiroLogo';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requestPasswordReset, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Erreur', 'Saisis ton email');
      return;
    }
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      Alert.alert(
        'Envoi impossible',
        e instanceof Error ? e.message : 'Erreur inconnue'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <KojiroLogo size={96} style={styles.logo} />
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          {sent
            ? 'Si un compte existe avec cet email, tu recevras un lien pour réinitialiser ton mot de passe.'
            : 'Saisis ton email et on t’envoie un lien de réinitialisation.'}
        </Text>

        {!sent && (
          <>
            <Input
              label="Email"
              placeholder="ton@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />
            <Button
              title="Envoyer le lien"
              onPress={handleSubmit}
              loading={isLoading}
              fullWidth
              size="lg"
            />
          </>
        )}

        {sent && (
          <Button
            title="Retour à la connexion"
            onPress={() => router.replace('/(auth)/login')}
            fullWidth
            size="lg"
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
