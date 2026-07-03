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
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, loginWithProvider, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    const success = await register(email, password, name);
    if (success) router.replace('/(tabs)');
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
        <Text style={styles.title}>Rejoins Kojiro</Text>
        <Text style={styles.subtitle}>Crée ton profil de joueur en quelques secondes</Text>

        <Input label="Nom complet" placeholder="Julien Martin" value={name} onChangeText={setName} icon="person-outline" />
        <Input label="Email" placeholder="ton@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
        <Input label="Mot de passe" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry icon="lock-closed-outline" />

        <Button title="Créer mon compte" onPress={handleRegister} loading={isLoading} fullWidth size="lg" />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou continuer avec</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.social}>
          <Pressable style={styles.socialBtn} onPress={() => loginWithProvider('google').then(() => router.replace('/(tabs)'))}>
            <Ionicons name="logo-google" size={22} color={Colors.text} />
            <Text style={styles.socialText}>Google</Text>
          </Pressable>
          <Pressable style={styles.socialBtn} onPress={() => loginWithProvider('apple').then(() => router.replace('/(tabs)'))}>
            <Ionicons name="logo-apple" size={22} color={Colors.text} />
            <Text style={styles.socialText}>Apple</Text>
          </Pressable>
        </View>

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
  title: { ...Typography.h1, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.xxxl },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.xxl, gap: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { ...Typography.caption, color: Colors.textMuted },
  social: { flexDirection: 'row', gap: Spacing.md },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, backgroundColor: Colors.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  socialText: { ...Typography.bodyBold, color: Colors.text, fontSize: 14 },
  link: { alignItems: 'center', marginTop: Spacing.xxl },
  linkText: { ...Typography.body, color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});
