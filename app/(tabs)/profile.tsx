import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BadgeGrid,
  buildProfileSeasonStats,
  LevelProgress,
  ProfileGlobalRating,
  ProfileHeader,
  ProfileSeasonStatsGrid,
  ProfileSectionTitle,
} from '@/components/profile/ProfileComponents';
import { Button } from '@/components/ui/Button';
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm }]}
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader
        user={user}
        onEdit={() => router.push('/profile/edit')}
      />

      <LevelProgress user={user} />

      <ProfileSectionTitle title="Stats de la saison" />
      <ProfileGlobalRating user={user} />
      <ProfileSeasonStatsGrid stats={buildProfileSeasonStats(user)} />

      <ProfileSectionTitle
        title="Badges"
        action="Voir tous"
        onAction={() => {}}
      />
      <BadgeGrid badges={user.badges} />

      <ProfileSectionTitle title="Menu" />
      <View style={styles.menuList}>
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            style={styles.menuItem}
            onPress={() => router.push(item.route as never)}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color={Colors.primary}
              />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        ))}
      </View>

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
  menuList: {
    gap: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { ...Typography.body, color: Colors.text, flex: 1 },
  logout: { marginTop: Spacing.xxl, marginBottom: Spacing.lg },
  bottomSpacer: { height: 100 },
});
