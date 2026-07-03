import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, router]);

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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="match/create" options={{ title: 'Créer un match', presentation: 'modal' }} />
            <Stack.Screen name="match/[id]" options={{ title: 'Détail du match' }} />
            <Stack.Screen name="match/teams" options={{ title: 'Composition des équipes' }} />
            <Stack.Screen name="match/chat" options={{ title: 'Chat du match' }} />
            <Stack.Screen name="map/index" options={{ title: 'Matchs à proximité' }} />
            <Stack.Screen name="profile/stats" options={{ title: 'Statistiques' }} />
            <Stack.Screen name="profile/history" options={{ title: 'Historique' }} />
            <Stack.Screen name="profile/edit" options={{ title: 'Modifier le profil', presentation: 'modal' }} />
            <Stack.Screen name="rankings/index" options={{ title: 'Classement' }} />
            <Stack.Screen name="tournament/index" options={{ title: 'Tournois' }} />
            <Stack.Screen name="social/feed" options={{ title: 'Highlights' }} />
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
});
