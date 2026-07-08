import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BadgeGrid, LevelProgress, ProfileHeader } from '@/components/profile/ProfileComponents';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatGrid } from '@/components/ui/StatCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

const MENU_ITEMS = [
  { icon: 'stats-chart', label: 'Statistiques détaillées', route: '/profile/stats' },
  { icon: 'time', label: 'Historique des matchs', route: '/profile/history' },
  { icon: 'trophy', label: 'Tournois', route: '/tournament' },
  { icon: 'podium-outline', label: 'Classement amis', route: '/rankings' },
  { icon: 'videocam', label: 'Highlights', route: '/social/feed' },
  { icon: 'settings-outline', label: 'Paramètres', route: '/profile/edit' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  if (!user) return null;

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Veux-tu vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Text style={styles.title}>Profil</Text>
        <Pressable onPress={() => router.push('/profile/edit')}>
          <Ionicons name="create-outline" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      <ProfileHeader user={user} />

      <View style={styles.section}>
        <LevelProgress user={user} />
      </View>

      <SectionHeader title="Stats de la saison" />
      <StatGrid
        stats={[
          { label: 'Matchs', value: user.stats.matchesPlayed, icon: '⚽' },
          { label: 'Buts', value: user.stats.goals, icon: '🎯' },
          { label: 'Passes', value: user.stats.assists, icon: '🅰️' },
          { label: 'Note moy.', value: user.stats.averageRating, icon: '⭐' },
          { label: 'MVP', value: user.stats.mvpCount, icon: '🏆' },
          { label: 'Fair-play', value: `${user.stats.averageFairPlay}/5`, icon: '🤝' },
        ]}
      />

      <SectionHeader title="Badges" />
      <BadgeGrid badges={user.badges} />

      <SectionHeader title="Menu" />
      {MENU_ITEMS.map((item) => (
        <Pressable
          key={item.route}
          style={styles.menuItem}
          onPress={() => router.push(item.route as never)}
        >
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={Colors.textSecondary} />
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      ))}

      <Button
        title="Se déconnecter"
        onPress={handleLogout}
        variant="outline"
        fullWidth
        style={styles.logout}
      />

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.xxl },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  title: { ...Typography.h1, color: Colors.text },
  section: { marginBottom: Spacing.lg },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  menuLabel: { ...Typography.body, color: Colors.text, flex: 1 },
  logout: { marginTop: Spacing.xxl, marginBottom: Spacing.lg },
  bottomSpacer: { height: 100 },
});
