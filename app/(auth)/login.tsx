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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KojiroLogo } from '@/components/ui/KojiroLogo';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    try {
      const success = await login(email, password);
      if (success) router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Connexion impossible', e instanceof Error ? e.message : 'Erreur inconnue');
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
        <Text style={styles.title}>Bon retour !</Text>
        <Text style={styles.subtitle}>Connecte-toi pour retrouver tes matchs</Text>

        <Input
          label="Email"
          placeholder="ton@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail-outline"
        />
        <Input
          label="Mot de passe"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          icon="lock-closed-outline"
        />

        <Button title="Se connecter" onPress={handleLogin} loading={isLoading} fullWidth size="lg" />

        <Pressable onPress={() => router.push('/(auth)/register')} style={styles.link}>
          <Text style={styles.linkText}>
            Pas encore de compte ? <Text style={styles.linkBold}>S'inscrire</Text>
          </Text>
        </Pressable>
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
  link: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  linkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  linkBold: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
