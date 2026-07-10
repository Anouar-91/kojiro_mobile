import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ProfileStatIcons,
  ProfileStatIconKey,
  ProfileStatIconSizes,
} from '@/constants/profileIcons';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { User } from '@/types';
import { getPositionLabel } from '@/utils/formatters';

const BADGE_SLOTS = 5;

function CircularRing({
  size,
  strokeWidth,
  progress,
  contentInset,
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  contentInset?: number;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clamped);
  const inset = contentInset ?? strokeWidth + 14;
  const innerSize = size - inset * 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.surfaceHighlight}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.primary}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children != null && (
        <View
          style={{
            width: innerSize,
            height: innerSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

export function ProfileSectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleLeft}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      </View>
      {action && onAction && (
        <Pressable onPress={onAction} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action.toUpperCase()}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

interface LevelProgressProps {
  user: User;
}

export function LevelProgress({ user }: LevelProgressProps) {
  const progress = user.xp / user.xpToNextLevel;

  return (
    <View style={styles.levelCard}>
      <CircularRing size={72} strokeWidth={4} progress={progress}>
        <Text style={styles.levelRingLabel}>NIVEAU</Text>
        <Text style={styles.levelRingNumber}>{user.level}</Text>
      </CircularRing>
      <View style={styles.levelInfo}>
        <Text style={styles.xpText}>
          {user.xp} / {user.xpToNextLevel} XP
        </Text>
        <ProgressBar progress={progress} height={4} />
      </View>
    </View>
  );
}

interface ProfileGlobalRatingProps {
  user: User;
}

export function ProfileGlobalRating({ user }: ProfileGlobalRatingProps) {
  const globalRating = Number(user.stats.averageRating).toFixed(1);
  const ringProgress = Math.min(Number(user.stats.averageRating) / 5, 1);

  return (
    <View style={styles.globalRatingCard}>
      <CircularRing size={158} strokeWidth={3} progress={ringProgress} contentInset={26}>
        <View style={styles.globalRatingInner}>
          <Image
            source={ProfileStatIcons.rating}
            style={styles.globalRatingIcon}
            contentFit="contain"
          />
          <Text style={styles.globalRatingValue}>{globalRating}</Text>
          <Text style={styles.globalRatingLabel} numberOfLines={1} adjustsFontSizeToFit>
            NOTE GLOBALE
          </Text>
        </View>
      </CircularRing>
    </View>
  );
}

interface ProfileHeaderProps {
  user: User;
  onEdit?: () => void;
}

export function ProfileHeader({ user, onEdit }: ProfileHeaderProps) {
  return (
    <View style={styles.profileHeader}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarRing}>
          <Image source={{ uri: user.avatar }} style={styles.avatarImage} contentFit="cover" />
        </View>
      </View>

      <View style={styles.profileInfo}>
        <Text style={styles.profileName} numberOfLines={1}>
          {user.name}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.profileCity} numberOfLines={1}>
            {user.city}
          </Text>
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

      {onEdit && (
        <Pressable onPress={onEdit} style={styles.headerActionBtn} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={Colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

interface ProfileSeasonStat {
  key: ProfileStatIconKey;
  label: string;
  value: string | number;
  accent?: boolean;
}

export function ProfileSeasonStatsGrid({ stats }: { stats: ProfileSeasonStat[] }) {
  return (
    <View style={styles.seasonStatsGrid}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.seasonStatCard}>
          <View style={styles.seasonStatIconSlot}>
            <Image
              source={ProfileStatIcons[stat.key]}
              style={ProfileStatIconSizes[stat.key]}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.seasonStatValue, stat.accent && styles.seasonStatValueAccent]}>
            {stat.value}
          </Text>
          <Text style={styles.seasonStatLabel}>{stat.label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

export function buildProfileSeasonStats(user: User): ProfileSeasonStat[] {
  return [
    { key: 'match', label: 'Matchs', value: user.stats.matchesPlayed },
    { key: 'goal', label: 'Buts', value: user.stats.goals },
    { key: 'assist', label: 'Passes', value: user.stats.assists },
    { key: 'mvp', label: 'MVP', value: user.stats.mvpCount },
    {
      key: 'fairPlay',
      label: 'Fair-play',
      value: `${Number(user.stats.averageFairPlay).toFixed(1)}/5`,
      accent: true,
    },
    {
      key: 'defense',
      label: 'Défense',
      value: `${Number(user.stats.averageDefensiveRating).toFixed(1)}/5`,
      accent: true,
    },
  ];
}

interface BadgeGridProps {
  badges: User['badges'];
  showAll?: boolean;
}

export function BadgeGrid({ badges, showAll = false }: BadgeGridProps) {
  if (showAll) {
    if (badges.length === 0) {
      return <Text style={styles.badgeEmptyText}>Aucun badge débloqué pour le moment.</Text>;
    }
    return (
      <View style={styles.badgeGridAll}>
        {badges.map((badge) => (
          <View key={badge.id} style={styles.badgeShield}>
            <Text style={styles.badgeIcon}>{badge.icon}</Text>
            <Text style={styles.badgeName} numberOfLines={2}>
              {badge.name}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const slots = Array.from({ length: BADGE_SLOTS }, (_, i) => badges[i] ?? null);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.badgeScroll}
    >
      {slots.map((badge, i) => {
        const earned = badge != null;
        return (
          <View
            key={badge?.id ?? `slot-${i}`}
            style={[styles.badgeShieldSlot, !earned && styles.badgeShieldLocked]}
          >
            {earned ? (
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
            ) : (
              <Ionicons name="shield-outline" size={28} color={Colors.borderLight} />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionActionText: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.md,
  },
  levelRingLabel: {
    ...Typography.small,
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  levelRingNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    lineHeight: 24,
  },
  levelInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  xpText: {
    ...Typography.bodyBold,
    color: Colors.text,
  },
  globalRatingCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  globalRatingInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  globalRatingIcon: {
    width: 22,
    height: 22,
    marginBottom: 2,
    opacity: 0.85,
  },
  globalRatingValue: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 34,
  },
  globalRatingLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
    maxWidth: '100%',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  avatarWrap: {
    flexShrink: 0,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: Colors.primary,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    paddingTop: Spacing.xs,
  },
  profileName: {
    ...Typography.h2,
    color: Colors.text,
    flexShrink: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profileCity: {
    ...Typography.caption,
    color: Colors.textMuted,
    flexShrink: 1,
  },
  profileTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.25)',
  },
  tagText: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '700',
  },
  headerActionBtn: {
    padding: 4,
    paddingTop: 2,
  },
  seasonStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  seasonStatCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  seasonStatIconSlot: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  seasonStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  seasonStatValueAccent: {
    color: Colors.primary,
  },
  seasonStatLabel: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  badgeScroll: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  badgeGridAll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  badgeEmptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  badgeShieldSlot: {
    width: 56,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  badgeShield: {
    width: 72,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.sm,
  },
  badgeShieldLocked: {
    borderColor: Colors.border,
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeName: {
    ...Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
