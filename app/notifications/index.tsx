import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useMatchStore } from '@/store/matchStore';
import { formatRelativeTime } from '@/utils/formatters';

const NOTIF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  match_invite: 'mail-open-outline',
  match_reminder: 'alarm-outline',
  team_assigned: 'people-outline',
  social: 'heart-outline',
  tournament: 'trophy-outline',
};

export default function NotificationsScreen() {
  const notifications = useMatchStore((s) => s.notifications);
  const markRead = useMatchStore((s) => s.markNotificationRead);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {notifications.map((notif) => (
        <Pressable
          key={notif.id}
          style={[styles.item, !notif.read && styles.unread]}
          onPress={() => markRead(notif.id)}
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
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
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
