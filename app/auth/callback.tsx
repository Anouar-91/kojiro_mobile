import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { Colors } from '@/constants/theme';
import { createSessionFromUrl } from '@/services/auth/oauth';
import { fetchProfile } from '@/services/profiles';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) {
        router.replace('/(auth)/login');
        return;
      }
      try {
        await createSessionFromUrl(url);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            useAuthStore.setState({ user: profile, isAuthenticated: true });
          }
        }
        router.replace('/(tabs)');
      } catch {
        router.replace('/(auth)/login');
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
