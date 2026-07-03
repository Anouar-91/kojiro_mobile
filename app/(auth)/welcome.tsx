import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

const FEATURES = [
  { icon: '⚽', title: 'Organise des matchs', desc: '5v5, 7v7 ou 11v11 en quelques clics' },
  { icon: '🔍', title: 'Trouve des joueurs', desc: 'Carte interactive et matchs à proximité' },
  { icon: '📊', title: 'Suis tes stats', desc: 'Buts, passes, MVP et progression' },
  { icon: '🤝', title: 'Rejoins la communauté', desc: 'Classements, highlights et tournois' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800' }}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <LinearGradient
          colors={['transparent', 'rgba(10,10,11,0.8)', Colors.background]}
          style={styles.heroGradient}
        />
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>⚽</Text>
          </View>
          <Text style={styles.logoText}>KOJIRO</Text>
          <Text style={styles.tagline}>
            Joue. Progresse. Connecte-toi.{'\n'}Vis le foot.
          </Text>
        </View>
      </ImageBackground>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.feature}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button title="Commencer" onPress={() => router.push('/(auth)/register')} fullWidth size="lg" />
        <Button
          title="J'ai déjà un compte"
          onPress={() => router.push('/(auth)/login')}
          variant="ghost"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    height: 340,
    justifyContent: 'flex-end',
  },
  heroImage: {
    opacity: 0.6,
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
  },
  logoWrap: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoEmoji: {
    fontSize: 32,
  },
  logoText: {
    ...Typography.hero,
    color: Colors.text,
    letterSpacing: 4,
  },
  tagline: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.bodyBold,
    color: Colors.text,
  },
  featureDesc: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actions: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
});
