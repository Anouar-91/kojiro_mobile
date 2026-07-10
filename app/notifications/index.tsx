import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChipGroup } from '@/components/ui/Chip';
import { Colors, Spacing, Typography } from '@/constants/theme';
import {
  fetchNotificationsPage,
  NOTIFICATIONS_PAGE_SIZE,
  NotificationReadFilter,
} from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { Notification } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

const NOTIF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  match_invite: 'mail-open-outline',
  match_waitlist: 'hourglass-outline',
  friend_request: 'person-add-outline',
  friend_match_created: 'football-outline',
  match_reminder: 'alarm-outline',
  match_recap: 'document-text-outline',
  match_stats: 'football-outline',
  team_assigned: 'people-outline',
  chat_message: 'chatbubbles-outline',
  social: 'heart-outline',
  tournament: 'trophy-outline',
};

const FILTER_OPTIONS: { label: string; value: NotificationReadFilter }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'Non lues', value: 'unread' },
  { label: 'Lues', value: 'read' },
];

function getNotificationRoute(notif: Notification): string | null {
  const matchId = notif.data?.matchId;
  if (matchId && notif.type === 'chat_message') {
    return `/match/chat?id=${matchId}`;
  }
  if (matchId && notif.type === 'match_recap') {
    return `/match/recap?id=${matchId}`;
  }
  if (matchId && notif.type === 'match_stats') {
    return `/match/stats?id=${matchId}`;
  }
  if (matchId && (notif.type === 'match_invite' || notif.type === 'match_reminder' || notif.type === 'team_assigned' || notif.type === 'match_waitlist' || notif.type === 'friend_match_created')) {
    return `/match/${matchId}`;
  }
  if (notif.type === 'tournament') return '/tournament';
  if (notif.type === 'social') return '/social/feed';
  if (notif.type === 'friend_request') return '/(tabs)/community';
  return null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const userId = useAuthStore((s) => s.user?.id);
  const markRead = useMatchStore((s) => s.markNotificationRead);
  const markAllRead = useMatchStore((s) => s.markAllNotificationsRead);
  const unreadCount = useMatchStore((s) => s.unreadNotificationsCount);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readFilter, setReadFilter] = useState<NotificationReadFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const readFilterRef = useRef(readFilter);
  const notificationsRef = useRef(notifications);
  const prevUnreadRef = useRef(unreadCount);

  readFilterRef.current = readFilter;
  hasMoreRef.current = hasMore;
  notificationsRef.current = notifications;

  const loadPage = useCallback(
    async (options: { reset?: boolean; beforeCreatedAt?: string } = {}) => {
      if (!userId) return;

      const filter = readFilterRef.current;
      const page = await fetchNotificationsPage(userId, {
        beforeCreatedAt: options.beforeCreatedAt,
        readFilter: filter,
      });

      setNotifications((prev) => {
        if (options.reset) return page;
        const ids = new Set(prev.map((n) => n.id));
        const unique = page.filter((n) => !ids.has(n.id));
        return [...prev, ...unique];
      });
      setHasMore(page.length >= NOTIFICATIONS_PAGE_SIZE);
    },
    [userId],
  );

  const refreshList = useCallback(async () => {
    if (!userId) return;
    setHasMore(true);
    await loadPage({ reset: true });
  }, [userId, loadPage]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMoreRef.current || !hasMoreRef.current) return;

    const current = notificationsRef.current;
    const last = current[current.length - 1];
    if (!last) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await loadPage({ beforeCreatedAt: last.createdAt });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [userId, loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshList();
    } finally {
      setRefreshing(false);
    }
  }, [refreshList]);

  const handleMarkAllRead = useCallback(async () => {
    if (!userId || unreadCount === 0) return;
    await markAllRead(userId);
    if (readFilterRef.current === 'unread') {
      setNotifications([]);
      setHasMore(false);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId, unreadCount, markAllRead]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
          style={({ pressed }) => [styles.markAllBtn, pressed && unreadCount > 0 && styles.pressed]}
        >
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>
            Tout lire
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, handleMarkAllRead, unreadCount]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      refreshList()
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [refreshList]),
  );

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && readFilter !== 'read') {
      refreshList().catch(() => {});
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, readFilter, refreshList]);

  const handleFilterChange = useCallback(
    (value: string | number) => {
      const next = value as NotificationReadFilter;
      setReadFilter(next);
      readFilterRef.current = next;
      setLoading(true);
      setHasMore(true);
      if (!userId) {
        setLoading(false);
        return;
      }
      fetchNotificationsPage(userId, { readFilter: next })
        .then((page) => {
          setNotifications(page);
          setHasMore(page.length >= NOTIFICATIONS_PAGE_SIZE);
        })
        .catch(() => setNotifications([]))
        .finally(() => setLoading(false));
    },
    [userId],
  );

  const handlePress = async (notif: Notification) => {
    if (!notif.read) {
      await markRead(notif.id);
      if (readFilter === 'unread') {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
        );
      }
    }
    const route = getNotificationRoute(notif);
    if (!route) return;
    if (notif.type === 'chat_message' && notif.data?.matchId) {
      router.push({ pathname: '/match/chat', params: { id: notif.data.matchId } });
      return;
    }
    if (notif.type === 'match_recap' && notif.data?.matchId) {
      router.push({ pathname: '/match/recap', params: { id: notif.data.matchId } });
      return;
    }
    if (notif.type === 'match_stats' && notif.data?.matchId) {
      router.push({ pathname: '/match/stats', params: { id: notif.data.matchId } });
      return;
    }
    router.push(route as `/match/${string}`);
  };

  const renderItem = ({ item: notif }: { item: Notification }) => (
    <Pressable
      style={[styles.item, !notif.read && styles.unread]}
      onPress={() => handlePress(notif)}
    >
      <View style={[styles.iconWrap, !notif.read && styles.iconWrapUnread]}>
        <Ionicons
          name={NOTIF_ICONS[notif.type] ?? 'notifications-outline'}
          size={22}
          color={notif.read ? Colors.textMuted : Colors.primary}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, !notif.read && styles.titleUnread]}>{notif.title}</Text>
        <Text style={styles.body}>{notif.body}</Text>
        <Text style={styles.time}>{formatRelativeTime(notif.createdAt)}</Text>
      </View>
      {!notif.read && <View style={styles.dot} />}
    </Pressable>
  );

  const listEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      );
    }
    const emptyMessage =
      readFilter === 'unread'
        ? 'Aucune notification non lue.'
        : readFilter === 'read'
          ? 'Aucune notification lue.'
          : 'Aucune notification pour le moment.';
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  };

  const listFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={Colors.primary} size="small" />
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <ChipGroup
          options={FILTER_OPTIONS}
          selected={readFilter}
          onSelect={handleFilterChange}
        />
      }
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, flexGrow: 1 },
  centered: { marginTop: Spacing.xxxl, alignItems: 'center' },
  empty: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxxl },
  footerLoader: { paddingVertical: Spacing.lg, alignItems: 'center' },
  markAllBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  markAllText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  markAllTextDisabled: { color: Colors.textMuted },
  pressed: { opacity: 0.7 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  unread: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.2)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: Colors.surface,
  },
  textWrap: { flex: 1 },
  title: { ...Typography.bodyBold, color: Colors.textSecondary, fontSize: 14 },
  titleUnread: { color: Colors.text },
  body: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  time: { ...Typography.small, color: Colors.textMuted, marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
});
