import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { ChatMessage } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  senderName?: string;
  senderAvatar?: string;
}

export function ChatBubble({ message, isOwn, senderName, senderAvatar }: ChatBubbleProps) {
  if (message.type === 'system') {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      {!isOwn && senderAvatar && (
        <Avatar uri={senderAvatar} size={32} name={senderName} />
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
          {message.content}
        </Text>
        <Text style={[styles.timestamp, isOwn && styles.timestampOwn]}>
          {formatRelativeTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

interface ChatInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
}

export function ChatInputBar({ value, onChangeText, onSend }: ChatInputBarProps) {
  return (
    <View style={styles.inputBar}>
      <View style={styles.inputWrap}>
        <Text
          style={styles.inputPlaceholder}
          onPress={() => {}}
        >
          {/* Using a simple approach - parent will handle TextInput */}
        </Text>
      </View>
      <View style={styles.sendBtn} onTouchEnd={onSend}>
        <Ionicons name="send" size={20} color={Colors.background} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  systemWrap: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  systemText: {
    ...Typography.small,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    maxWidth: '85%',
  },
  bubbleRowOwn: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  bubble: {
    borderRadius: 16,
    padding: Spacing.md,
    maxWidth: '100%',
  },
  bubbleOwn: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  senderName: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    ...Typography.body,
    color: Colors.text,
    fontSize: 15,
  },
  messageTextOwn: {
    color: Colors.background,
  },
  timestamp: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timestampOwn: {
    color: 'rgba(0,0,0,0.4)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputPlaceholder: {
    color: Colors.textMuted,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
