import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChatBubble } from '@/components/chat/ChatComponents';
import { Colors, Spacing } from '@/constants/theme';
import {
  markChatNotificationsRead,
  markChatRead,
  setActiveChatMatchId,
} from '@/services/chatReads';
import { fetchProfile } from '@/services/profiles';
import { fetchMessages, sendMessage, subscribeToMessages } from '@/services/messages';
import { setSuppressChatBannerMatchId } from '@/services/push';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { ChatMessage, User } from '@/types';

export default function MatchChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senders, setSenders] = useState<Record<string, User>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const fetchNotifications = useMatchStore((s) => s.fetchNotifications);

  const syncRead = useCallback(async () => {
    if (!match || !user) return;
    await markChatRead(match.id, user.id);
    await markChatNotificationsRead(match.id, user.id).catch(() => {});
    await fetchNotifications(user.id).catch(() => {});
  }, [match, user, fetchNotifications]);

  useEffect(() => {
    if (!match) return;

    setActiveChatMatchId(match.id);
    setSuppressChatBannerMatchId(match.id);
    syncRead();

    return () => {
      setActiveChatMatchId(null);
      setSuppressChatBannerMatchId(null);
    };
  }, [match?.id, syncRead]);

  useEffect(() => {
    if (!match) return;

    let active = true;

    fetchMessages(match.id)
      .then((msgs) => {
        if (!active) return;
        setMessages(msgs);
        msgs.forEach((m) => {
          if (m.senderId !== 'system') {
            fetchProfile(m.senderId).then((profile) => {
              if (profile && active) {
                setSenders((prev) => ({ ...prev, [m.senderId]: profile }));
              }
            });
          }
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = subscribeToMessages(match.id, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.senderId !== 'system') {
        fetchProfile(msg.senderId).then((profile) => {
          if (profile) setSenders((prev) => ({ ...prev, [msg.senderId]: profile }));
        });
      }
      if (user && msg.senderId !== user.id) {
        syncRead();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [match, user, syncRead]);

  const handleSend = async () => {
    if (!input.trim() || !user || !match || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(match.id, user.id, input.trim());
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setSenders((prev) => ({ ...prev, [user.id]: user }));
      setInput('');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const sender = item.senderId === user?.id ? user : senders[item.senderId];
          return (
            <ChatBubble
              message={item}
              isOwn={item.senderId === user?.id}
              senderName={sender?.name}
              senderAvatar={sender?.avatar}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun message. Lance la conversation !</Text>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.lg, flexGrow: 1 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxxl },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: Colors.background, fontSize: 18, fontWeight: '700' },
});
