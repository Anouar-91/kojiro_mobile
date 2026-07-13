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

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    try {
      const success = await register(email, password, name);
      if (success) router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Inscription impossible', e instanceof Error ? e.message : 'Erreur inconnue');
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
        <Text style={styles.title}>Rejoins Kojiro</Text>
        <Text style={styles.subtitle}>Crée ton profil de joueur en quelques secondes</Text>

        <Input label="Nom complet" placeholder="Julien Martin" value={name} onChangeText={setName} icon="person-outline" />
        <Input label="Email" placeholder="ton@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
        <Input label="Mot de passe" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry icon="lock-closed-outline" />

        <Button title="Créer mon compte" onPress={handleRegister} loading={isLoading} fullWidth size="lg" />

        <Pressable onPress={() => router.push('/(auth)/login')} style={styles.link}>
          <Text style={styles.linkText}>
            Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  back: { padding: Spacing.lg },
  scroll: { padding: Spacing.xxl, paddingTop: Spacing.lg },
  logo: { alignSelf: 'center', marginBottom: Spacing.xl },
  title: { ...Typography.h1, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.xxxl },
  link: { alignItems: 'center', marginTop: Spacing.xxl },
  linkText: { ...Typography.body, color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});
