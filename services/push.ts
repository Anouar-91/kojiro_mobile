import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

let suppressChatBannerMatchId: string | null = null;

export function setSuppressChatBannerMatchId(matchId: string | null): void {
  suppressChatBannerMatchId = matchId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    const matchId = typeof data?.matchId === 'string' ? data.matchId : null;
    const isChat = data?.chat === 'true' || data?.chat === true;

    if (isChat && matchId && suppressChatBannerMatchId === matchId) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    await supabase.from('profiles').update({ push_token: tokenData.data }).eq('id', userId);
  } catch {
    // Expo Go sans projectId EAS : push ignoré silencieusement
  }
}

export function setupNotificationListeners(
  onTap?: (data: Record<string, unknown>) => void
): () => void {
  const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data && onTap) onTap(data as Record<string, unknown>);
  });
  return () => tapSub.remove();
}

export function setupForegroundNotificationListener(onReceived?: () => void): () => void {
  if (!onReceived) return () => {};
  const sub = Notifications.addNotificationReceivedListener(() => {
    onReceived();
  });
  return () => sub.remove();
}

export async function setAppBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(count);
}
