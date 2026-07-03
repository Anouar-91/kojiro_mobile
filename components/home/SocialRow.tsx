import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { User } from '@/types';
import { getPositionLabel } from '@/utils/formatters';

interface ActiveFriendsRowProps {
  friends: User[];
}

export function ActiveFriendsRow({ friends }: ActiveFriendsRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {friends.map((friend) => (
        <View key={friend.id} style={styles.friend}>
          <View style={styles.avatarWrap}>
            <Avatar uri={friend.avatar} size={56} name={friend.name} />
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.name} numberOfLines={1}>{friend.name.split(' ')[0]}</Text>
          <Text style={styles.position}>{getPositionLabel(friend.position)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

interface NewsCardProps {
  title: string;
  summary: string;
  imageUrl: string;
  category: string;
  onPress?: () => void;
}

export function NewsCard({ title, summary, imageUrl, category, onPress }: NewsCardProps) {
  return (
    <Card onPress={onPress} style={styles.newsCard} padding={0}>
      <Image source={{ uri: imageUrl }} style={styles.newsImage} contentFit="cover" />
      <View style={styles.newsContent}>
        <Text style={styles.category}>{category}</Text>
        <Text style={styles.newsTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.summary} numberOfLines={2}>{summary}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
  },
  friend: {
    alignItems: 'center',
    width: 72,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: Spacing.xs,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  name: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  position: {
    ...Typography.small,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  newsCard: {
    width: 280,
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  newsImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  newsContent: {
    padding: Spacing.md,
  },
  category: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  newsTitle: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  summary: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
