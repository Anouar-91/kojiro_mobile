import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat/ChatComponents';
import { Colors, Spacing } from '@/constants/theme';
import {
  markChatNotificationsRead,
  markChatRead,
  setActiveChatMatchId,
} from '@/services/chatReads';
import {
  CHAT_PAGE_SIZE,
  fetchOlderMessages,
  fetchRecentMessages,
  sendMessage,
  subscribeToMessages,
} from '@/services/messages';
import { fetchProfile } from '@/services/profiles';
import { setSuppressChatBannerMatchId } from '@/services/push';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { ChatMessage, User } from '@/types';
import { openUserProfile } from '@/utils/profileNavigation';

export default function MatchChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senders, setSenders] = useState<Record<string, User>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const fetchNotifications = useMatchStore((s) => s.fetchNotifications);
  const upsertProfile = useProfileStore((s) => s.upsertProfile);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const shouldScrollToEndRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const loadedSenderIdsRef = useRef(new Set<string>());
  const messagesRef = useRef<ChatMessage[]>([]);
  const hasMoreOlderRef = useRef(false);
  const canAutoLoadOlderRef = useRef(false);
  const insets = useSafeAreaInsets();

  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);

  messagesRef.current = messages;
  hasMoreOlderRef.current = hasMoreOlder;

  const ensureSendersLoaded = useCallback((msgs: ChatMessage[]) => {
    msgs.forEach((m) => {
      if (m.senderId === 'system' || loadedSenderIdsRef.current.has(m.senderId)) return;
      loadedSenderIdsRef.current.add(m.senderId);
      fetchProfile(m.senderId).then((profile) => {
        if (profile) {
          upsertProfile(profile);
          setSenders((prev) => ({ ...prev, [m.senderId]: profile }));
        }
      });
    });
  }, [upsertProfile]);

  const scrollToLatest = useCallback((animated = true) => {
    shouldScrollToEndRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (shouldScrollToEndRef.current) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!match || loadingOlderRef.current || !hasMoreOlderRef.current || !canAutoLoadOlderRef.current) {
      return;
    }

    const current = messagesRef.current;
    if (current.length < CHAT_PAGE_SIZE) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    shouldScrollToEndRef.current = false;

    try {
      const older = await fetchOlderMessages(match.id, current[0].timestamp);
      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }

      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const unique = older.filter((m) => !ids.has(m.id));
        return [...unique, ...prev];
      });
      ensureSendersLoaded(older);
      setHasMoreOlder(older.length >= CHAT_PAGE_SIZE);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [match, ensureSendersLoaded]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    shouldScrollToEndRef.current = contentOffset.y <= 80;
    if (contentOffset.y > 120) {
      canAutoLoadOlderRef.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      shouldScrollToEndRef.current = true;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }, []),
  );

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
    loadedSenderIdsRef.current.clear();
    canAutoLoadOlderRef.current = false;
    setMessages([]);
    setHasMoreOlder(false);
    setLoading(true);

    fetchRecentMessages(match.id)
      .then((msgs) => {
        if (!active) return;
        setMessages(msgs);
        setHasMoreOlder(msgs.length >= CHAT_PAGE_SIZE);
        ensureSendersLoaded(msgs);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = subscribeToMessages(match.id, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      ensureSendersLoaded([msg]);
      if (user && msg.senderId !== user.id) {
        syncRead();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [match, user, syncRead, ensureSendersLoaded]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      const delay = Platform.OS === 'ios' ? event.duration ?? 250 : 100;
      setTimeout(() => scrollToLatest(), delay);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToLatest]);

  useEffect(() => {
    if (!loading && messages.length > 0 && shouldScrollToEndRef.current && !loadingOlderRef.current) {
      scrollToLatest(false);
    }
  }, [loading, messages.length, scrollToLatest]);

  const handleSend = async () => {
    if (!input.trim() || !user || !match || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(match.id, user.id, input.trim());
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setSenders((prev) => ({ ...prev, [user.id]: user }));
      setInput('');
      setTimeout(() => scrollToLatest(), 50);
    } finally {
      setSending(false);
    }
  };

  const loadOlderFooter = hasMoreOlder ? (
    <View style={styles.loadOlder}>
      {loadingOlder ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Pressable
          onPress={() => {
            canAutoLoadOlderRef.current = true;
            loadOlderMessages();
          }}
          hitSlop={8}
        >
          <Text style={styles.loadOlderText}>Voir les messages précédents</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const bottomInset = keyboardHeight > 0 ? keyboardHeight : insets.bottom;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        inverted={displayMessages.length > 0}
        data={displayMessages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          displayMessages.length === 0 && styles.listContentEmpty,
          { paddingTop: Spacing.md },
        ]}
        maintainVisibleContentPosition={
          displayMessages.length > 0 ? { minIndexForVisible: 0 } : undefined
        }
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.1}
        ListFooterComponent={loadOlderFooter}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        renderItem={({ item }) => {
          const sender = item.senderId === user?.id ? user : senders[item.senderId];
          const isOwn = item.senderId === user?.id;
          const canOpenProfile = !isOwn && item.senderId !== 'system';
          return (
            <ChatBubble
              message={item}
              isOwn={isOwn}
              senderName={sender?.name}
              senderAvatar={sender?.avatar}
              onSenderPress={
                canOpenProfile ? () => openUserProfile(router, item.senderId) : undefined
              }
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun message. Lance la conversation !</Text>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: Spacing.md + bottomInset }]}>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          blurOnSubmit={false}
        />
        <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  loadOlder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  loadOlderText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: { color: Colors.textMuted, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
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
