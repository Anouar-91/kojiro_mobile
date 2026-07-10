import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BadgeGrid,
  buildProfileSeasonStats,
  LevelProgress,
  ProfileGlobalRating,
  ProfileHeader,
  ProfileSeasonStatsGrid,
  ProfileSectionTitle,
} from '@/components/profile/ProfileComponents';
import { ProfileFriendActions } from '@/components/profile/ProfileFriendActions';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchProfile } from '@/services/profiles';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { User } from '@/types';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    if (currentUser?.id === id) {
      router.replace('/(tabs)/profile');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfile(id);
      if (!data) {
        setProfile(null);
        setError('Joueur introuvable');
        return;
      }
      setProfile(data);
    } catch (e) {
      setProfile(null);
      setError(e instanceof Error ? e.message : 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  }, [id, currentUser?.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (currentUser) {
      fetchFriends(currentUser.id);
    }
  }, [currentUser, fetchFriends]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorTitle}>Profil indisponible</Text>
        <Text style={styles.errorText}>{error ?? 'Ce joueur n\'existe pas.'}</Text>
      </View>
    );
  }

  const winRate =
    profile.stats.matchesPlayed > 0
      ? Math.round((profile.stats.wins / profile.stats.matchesPlayed) * 100)
      : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader user={profile} />

      <View style={styles.friendActions}>
        <ProfileFriendActions targetUser={profile} />
      </View>

      <LevelProgress user={profile} />

      <ProfileSectionTitle title="Stats de la saison" />
      <ProfileGlobalRating user={profile} />
      <ProfileSeasonStatsGrid stats={buildProfileSeasonStats(profile)} />

      <View style={styles.recordCard}>
        <View style={styles.recordRow}>
          <View style={styles.recordItem}>
            <Text style={[styles.recordValue, { color: Colors.success }]}>{profile.stats.wins}</Text>
            <Text style={styles.recordLabel}>Victoires</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={[styles.recordValue, { color: Colors.warning }]}>{profile.stats.draws}</Text>
            <Text style={styles.recordLabel}>Nuls</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={[styles.recordValue, { color: Colors.error }]}>{profile.stats.losses}</Text>
            <Text style={styles.recordLabel}>Défaites</Text>
          </View>
        </View>
        {profile.stats.matchesPlayed > 0 && (
          <Text style={styles.winRateText}>Taux de victoire : {winRate}%</Text>
        )}
      </View>

      <ProfileSectionTitle title="Badges" />
      <BadgeGrid badges={profile.badges} showAll />

      {profile.bio ? (
        <>
          <ProfileSectionTitle title="À propos" />
          <View style={styles.bioCard}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        </>
      ) : null}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxxl },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  errorTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.lg },
  errorText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  friendActions: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  recordCard: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  recordItem: { alignItems: 'center' },
  recordValue: { ...Typography.h2, fontWeight: '800' },
  recordLabel: { ...Typography.caption, color: Colors.textMuted, marginTop: 4 },
  winRateText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  bioCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bioText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  bottomSpacer: { height: Spacing.xxxl },
});
