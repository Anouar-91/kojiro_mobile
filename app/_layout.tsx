import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useNotificationSubscription } from '@/hooks/useNotificationSubscription';
import { useAppRealtime } from '@/hooks/useAppRealtime';
import { registerPushToken } from '@/services/push';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized, initialize } = useAuthStore();
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const fetchNotifications = useMatchStore((s) => s.fetchNotifications);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const userId = useAuthStore((s) => s.user?.id);
  const segments = useSegments();
  const router = useRouter();

  useNotificationSubscription(userId, (data) => {
    const matchId = data.matchId;
    if (typeof matchId !== 'string') return;
    const isChat = data.chat === 'true' || data.chat === true;
    const isRecap = data.recap === 'true' || data.recap === true;
    const isStats = data.stats === 'true' || data.stats === true;
    if (isChat) {
      router.push({ pathname: '/match/chat', params: { id: matchId } });
    } else if (isRecap) {
      router.push({ pathname: '/match/recap', params: { id: matchId } });
    } else if (isStats) {
      router.push({ pathname: '/match/stats', params: { id: matchId } });
    } else {
      router.push(`/match/${matchId}`);
    }
  });

  useAppRealtime(userId);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchMatches(userId);
      fetchProfiles();
      fetchFriends(userId);
      fetchNotifications(userId);
      registerPushToken(userId);
    }
  }, [isAuthenticated, userId, fetchMatches, fetchProfiles, fetchFriends, fetchNotifications]);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOAuthCallback = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup && !isOAuthCallback) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isInitialized, segments, router]);

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <AuthGuard>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: Colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Accueil' }} />
            <Stack.Screen name="match/create" options={{ title: 'Créer un match', presentation: 'modal' }} />
            <Stack.Screen name="match/[id]" options={{ title: 'Détail du match' }} />
            <Stack.Screen name="match/teams" options={{ title: 'Composition des équipes' }} />
            <Stack.Screen name="match/lineup" options={{ title: 'Formation' }} />
            <Stack.Screen name="match/chat" options={{ title: 'Chat du match' }} />
            <Stack.Screen name="match/complete" options={{ title: 'Terminer le match', presentation: 'modal' }} />
            <Stack.Screen name="match/stats" options={{ title: 'Stats du match', presentation: 'modal' }} />
            <Stack.Screen name="match/recap" options={{ title: 'Résumé du match' }} />
            <Stack.Screen name="match/invite" options={{ title: 'Inviter des joueurs' }} />
            <Stack.Screen
              name="map/index"
              options={{
                title: 'Matchs à proximité',
                headerShown: true,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen name="profile/stats" options={{ title: 'Statistiques' }} />
            <Stack.Screen name="profile/history" options={{ title: 'Historique' }} />
            <Stack.Screen name="profile/edit" options={{ title: 'Modifier le profil', presentation: 'modal' }} />
            <Stack.Screen name="rankings/index" options={{ title: 'Classement amis' }} />
            <Stack.Screen name="tournament/index" options={{ title: 'Tournois' }} />
            <Stack.Screen name="social/feed" options={{ title: 'Highlights' }} />
            <Stack.Screen name="social/create-post" options={{ title: 'Publier' }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="notifications/index" options={{ title: 'Notifications' }} />
          </Stack>
        </AuthGuard>
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
