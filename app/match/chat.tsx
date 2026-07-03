import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChatBubble } from '@/components/chat/ChatComponents';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getUserById, mockChatMessages } from '@/data/mock';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { ChatMessage } from '@/types';

export default function MatchChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const [messages, setMessages] = useState<ChatMessage[]>(
    mockChatMessages.filter((m) => m.chatId === match?.chatId || m.chatId === 'chat-1')
  );
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || !user || !match) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      chatId: match.chatId,
      senderId: user.id,
      content: input.trim(),
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
  };

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
          const sender = getUserById(item.senderId);
          return (
            <ChatBubble
              message={item}
              isOwn={item.senderId === user?.id}
              senderName={sender?.name}
              senderAvatar={sender?.avatar}
            />
          );
        }}
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
        <View style={styles.sendBtn} onTouchEnd={handleSend}>
          <Text style={styles.sendIcon}>➤</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, flexGrow: 1 },
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
