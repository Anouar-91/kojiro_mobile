import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { LeaderboardEntry, SocialPost, User } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
  users: Record<string, User>;
}

export function LeaderboardPodium({ entries, users }: LeaderboardPodiumProps) {
  const top3 = entries.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]];

  const heights = [80, 110, 60];
  const colors = [Colors.silver, Colors.gold, Colors.bronze];

  return (
    <View style={styles.podium}>
      {order.map((entry, i) => {
        if (!entry) return <View key={i} style={{ flex: 1 }} />;
        const user = users[entry.userId];
        const rank = entry.rank;
        return (
          <View key={entry.userId} style={styles.podiumItem}>
            <Avatar uri={user?.avatar ?? ''} size={rank === 1 ? 56 : 44} name={user?.name} showBorder />
            <Text style={styles.podiumName} numberOfLines={1}>{user?.name.split(' ')[0]}</Text>
            <Text style={styles.podiumScore}>{entry.score} XP</Text>
            <View style={[styles.podiumBar, { height: heights[i], backgroundColor: colors[i] }]}>
              <Text style={styles.podiumRank}>{rank}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

interface PlayerListItemProps {
  user: User;
  rank?: number;
  score?: number;
  distance?: string;
  friendState?: 'none' | 'friends' | 'pending_sent' | 'pending_received';
  onAdd?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
  onCancel?: () => void;
}

export function PlayerListItem({
  user,
  rank,
  score,
  distance,
  friendState = 'none',
  onAdd,
  onAccept,
  onDecline,
  onRemove,
  onCancel,
}: PlayerListItemProps) {
  return (
    <View style={styles.listItem}>
      {rank !== undefined && <Text style={styles.rank}>{rank}</Text>}
      <Avatar uri={user.avatar} size={44} name={user.name} />
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{user.name}</Text>
        <View style={styles.listMeta}>
          <Ionicons name="star" size={12} color={Colors.warning} />
          <Text style={styles.rating}>{user.rating}</Text>
          {distance && <Text style={styles.distance}> · {distance}</Text>}
        </View>
      </View>
      {score !== undefined && <Text style={styles.score}>{score} XP</Text>}
      {friendState === 'friends' && onRemove && (
        <Pressable onPress={onRemove} style={styles.removeBtn} accessibilityLabel="Retirer des amis">
          <Ionicons name="person-remove-outline" size={18} color={Colors.error} />
        </Pressable>
      )}
      {friendState === 'friends' && !onRemove && (
        <View style={styles.friendBadge}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
        </View>
      )}
      {friendState === 'pending_sent' && onCancel && (
        <Pressable onPress={onCancel} style={styles.declineBtn} accessibilityLabel="Annuler la demande">
          <Ionicons name="close" size={18} color={Colors.error} />
        </Pressable>
      )}
      {friendState === 'pending_sent' && !onCancel && (
        <View style={styles.friendBadge}>
          <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
        </View>
      )}
      {friendState === 'pending_received' && (onAccept || onDecline) && (
        <View style={styles.actionRow}>
          {onDecline && (
            <Pressable onPress={onDecline} style={styles.declineBtn} accessibilityLabel="Refuser">
              <Ionicons name="close" size={18} color={Colors.error} />
            </Pressable>
          )}
          {onAccept && (
            <Pressable onPress={onAccept} style={styles.acceptBtn} accessibilityLabel="Accepter">
              <Ionicons name="checkmark" size={18} color={Colors.background} />
            </Pressable>
          )}
        </View>
      )}
      {friendState === 'none' && onAdd && (
        <Pressable onPress={onAdd} style={styles.addBtn}>
          <Ionicons name="person-add" size={18} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

interface HighlightCardProps {
  post: SocialPost;
  author: User;
  onPress?: () => void;
}

export function HighlightCard({ post, author, onPress }: HighlightCardProps) {
  return (
    <Card onPress={onPress} style={styles.highlight} padding={0}>
      <View style={styles.highlightMedia}>
        {post.mediaUrl && (
          <Image source={{ uri: post.mediaUrl }} style={styles.highlightImage} contentFit="cover" />
        )}
        {post.type === 'video' && (
          <View style={styles.playOverlay}>
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </View>
      <View style={styles.highlightContent}>
        <Text style={styles.highlightText} numberOfLines={2}>{post.content}</Text>
        <View style={styles.highlightFooter}>
          <Avatar uri={author.avatar} size={24} name={author.name} />
          <Text style={styles.highlightAuthor}>{author.name.split(' ')[0]}</Text>
          <Text style={styles.highlightTime}>{formatRelativeTime(post.createdAt)}</Text>
          <View style={styles.highlightStats}>
            <Ionicons name="heart" size={14} color={Colors.error} />
            <Text style={styles.highlightLikes}>{post.likes}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
  },
  podiumName: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  podiumScore: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: {
    ...Typography.h2,
    color: Colors.background,
    fontWeight: '900',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  rank: {
    ...Typography.bodyBold,
    color: Colors.textMuted,
    width: 24,
    textAlign: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 15,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rating: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  distance: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  score: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.error}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.error}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  highlight: {
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  highlightMedia: {
    position: 'relative',
    height: 180,
  },
  highlightImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  highlightContent: {
    padding: Spacing.md,
  },
  highlightText: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  highlightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  highlightAuthor: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
  highlightTime: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  highlightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  highlightLikes: {
    ...Typography.small,
    color: Colors.textMuted,
  },
});
