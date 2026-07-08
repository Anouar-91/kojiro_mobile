import { useEffect } from 'react';
import { Platform } from 'react-native';

import { subscribeToNotifications } from '@/services/notifications';
import { setAppBadgeCount, setupForegroundNotificationListener, setupNotificationListeners } from '@/services/push';
import { useMatchStore } from '@/store/matchStore';

export function useNotificationSubscription(
  userId: string | undefined,
  onNotificationTap?: (data: Record<string, unknown>) => void
) {
  const fetchNotifications = useMatchStore((s) => s.fetchNotifications);
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const unreadCount = useMatchStore((s) => s.unreadCount);

  useEffect(() => {
    if (!userId) return;

    const refresh = () => {
      fetchNotifications(userId).catch(() => {});
      fetchMatches(userId).catch(() => {});
    };

    refresh();
    const unsubscribeRealtime = subscribeToNotifications(userId, refresh);

    const removeTapListener = setupNotificationListeners((data) => {
      onNotificationTap?.(data);
      refresh();
    });

    const removeForegroundListener = setupForegroundNotificationListener(refresh);

    return () => {
      unsubscribeRealtime();
      removeTapListener();
      removeForegroundListener();
    };
  }, [userId, fetchNotifications, fetchMatches, onNotificationTap]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    setAppBadgeCount(unreadCount()).catch(() => {});
  }, [unreadCount]);
}
