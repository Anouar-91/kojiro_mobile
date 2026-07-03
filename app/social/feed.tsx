import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HighlightCard } from '@/components/community/CommunityComponents';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing } from '@/constants/theme';
import { getUserById, mockSocialPosts } from '@/data/mock';

export default function SocialFeedScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button
        title="Publier un highlight"
        onPress={() => {}}
        icon="camera-outline"
        fullWidth
        style={styles.createBtn}
      />

      {mockSocialPosts.map((post) => {
        const author = getUserById(post.authorId);
        if (!author) return null;
        return <HighlightCard key={post.id} post={post} author={author} />;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xxl },
  createBtn: { marginBottom: Spacing.xl },
});
