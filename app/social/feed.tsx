import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HighlightCard } from '@/components/community/CommunityComponents';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { mockSocialPosts } from '@/data/mock';
import { useProfileStore } from '@/store/profileStore';

export default function SocialFeedScreen() {
  const getProfile = useProfileStore((s) => s.getProfile);
  const postsWithAuthors = mockSocialPosts
    .map((post) => ({ post, author: getProfile(post.authorId) }))
    .filter((item) => item.author);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button
        title="Publier un highlight"
        onPress={() => {}}
        icon="camera-outline"
        fullWidth
        style={styles.createBtn}
      />

      {postsWithAuthors.length === 0 ? (
        <Text style={styles.empty}>Les highlights arrivent bientôt !</Text>
      ) : (
        postsWithAuthors.map(({ post, author }) => (
          <HighlightCard key={post.id} post={post} author={author!} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  createBtn: { marginBottom: Spacing.xl },
  empty: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxxl },
});
