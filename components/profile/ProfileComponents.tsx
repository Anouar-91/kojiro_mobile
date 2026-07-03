import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { User } from '@/types';
import { getPositionLabel } from '@/utils/formatters';

interface LevelProgressProps {
  user: User;
}

export function LevelProgress({ user }: LevelProgressProps) {
  const progress = user.xp / user.xpToNextLevel;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelNumber}>{user.level}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.levelLabel}>Niveau {user.level}</Text>
          <Text style={styles.xpText}>{user.xp} / {user.xpToNextLevel} XP</Text>
        </View>
        <View style={styles.ratingBox}>
          <Ionicons name="star" size={16} color={Colors.warning} />
          <Text style={styles.rating}>{user.rating}</Text>
        </View>
      </View>
      <ProgressBar progress={progress} height={8} />
    </View>
  );
}

interface ProfileHeaderProps {
  user: User;
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  return (
    <View style={styles.profileHeader}>
      <View style={styles.avatarLarge}>
        <View style={styles.avatarRing}>
          <Image source={{ uri: user.avatar }} style={styles.avatarImage} contentFit="cover" />
        </View>
      </View>
      <Text style={styles.profileName}>{user.name}</Text>
      <View style={styles.profileMeta}>
        <Ionicons name="star" size={14} color={Colors.warning} />
        <Text style={styles.profileRating}>{user.rating}</Text>
        <Text style={styles.profileCity}> · {user.city}</Text>
      </View>
      <View style={styles.profileTags}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{getPositionLabel(user.position)}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>Pied {user.foot.toLowerCase()}</Text>
        </View>
      </View>
    </View>
  );
}

interface BadgeGridProps {
  badges: User['badges'];
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  return (
    <View style={styles.badgeGrid}>
      {badges.map((badge) => (
        <View key={badge.id} style={styles.badgeItem}>
          <Text style={styles.badgeIcon}>{badge.icon}</Text>
          <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    ...Typography.h3,
    color: Colors.background,
    fontWeight: '900',
  },
  info: {
    flex: 1,
  },
  levelLabel: {
    ...Typography.bodyBold,
    color: Colors.text,
  },
  xpText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  rating: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  avatarLarge: {
    marginBottom: Spacing.md,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    ...Typography.h2,
    color: Colors.text,
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  profileRating: {
    ...Typography.bodyBold,
    color: Colors.warning,
    marginLeft: 4,
  },
  profileCity: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  profileTags: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  tag: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  badgeItem: {
    width: '22%',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  badgeName: {
    ...Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
