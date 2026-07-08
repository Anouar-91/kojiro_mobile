import { useEffect } from 'react';
import { Platform } from 'react-native';

import { subscribeToNotifications } from '@/services/notifications';
import { setAppBadgeCount, setupForegroundNotificationListener, setupNotificationListeners } from '@/services/push';
import { useMatchStore } from '@/store/matchStore';

export function useNotificationSubscription(userId: string | undefined, onOpenMatch?: (matchId: string) => void) {
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
      const matchId = data.matchId;
      if (typeof matchId === 'string') {
        onOpenMatch?.(matchId);
      }
      refresh();
    });

    const removeForegroundListener = setupForegroundNotificationListener(refresh);

    return () => {
      unsubscribeRealtime();
      removeTapListener();
      removeForegroundListener();
    };
  }, [userId, fetchNotifications, fetchMatches, onOpenMatch]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    setAppBadgeCount(unreadCount()).catch(() => {});
  }, [unreadCount]);
}
