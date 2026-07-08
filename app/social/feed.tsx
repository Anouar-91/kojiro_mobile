import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HighlightCard } from '@/components/community/CommunityComponents';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { fetchSocialPosts, likePost, subscribeToSocialPosts } from '@/services/social';
import { useProfileStore } from '@/store/profileStore';
import { SocialPost } from '@/types';

export default function SocialFeedScreen() {
  const router = useRouter();
  const getProfile = useProfileStore((s) => s.getProfile);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const data = await fetchSocialPosts();
      setPosts(data);
      await fetchProfiles();
    } catch {
      setPosts([]);
    }
  }, [fetchProfiles]);

  useEffect(() => {
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

  useEffect(() => {
    const unsubscribe = subscribeToSocialPosts(() => {
      loadPosts().catch(() => {});
    });
    return unsubscribe;
  }, [loadPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    await likePost(postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p))
    );
  };

  const postsWithAuthors = posts
    .map((post) => ({ post, author: getProfile(post.authorId) }))
    .filter((item) => item.author);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <Button
        title="Publier un highlight"
        onPress={() => router.push('/social/create-post')}
        icon="camera-outline"
        fullWidth
        style={styles.createBtn}
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : postsWithAuthors.length === 0 ? (
        <Text style={styles.empty}>
          Aucun highlight pour l'instant.{'\n'}Sois le premier à publier !
        </Text>
      ) : (
        postsWithAuthors.map(({ post, author }) => (
          <HighlightCard
            key={post.id}
            post={post}
            author={author!}
            onPress={() => handleLike(post.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  createBtn: { marginBottom: Spacing.xl },
  loader: { marginTop: Spacing.xxxl },
  empty: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxxl },
});
