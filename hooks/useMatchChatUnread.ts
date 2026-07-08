import { useCallback, useEffect, useState } from 'react';

import {
  getActiveChatMatchId,
  getChatUnreadCount,
  onChatRead,
} from '@/services/chatReads';
import { subscribeToMessages } from '@/services/messages';

export function useMatchChatUnread(matchId: string | undefined, userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!matchId || !userId) {
      setUnreadCount(0);
      return;
    }
    if (getActiveChatMatchId() === matchId) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getChatUnreadCount(matchId, userId);
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [matchId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!matchId) return;
    return onChatRead((readMatchId) => {
      if (readMatchId === matchId) refresh();
    });
  }, [matchId, refresh]);

  useEffect(() => {
    if (!matchId || !userId) return;

    const unsubscribe = subscribeToMessages(matchId, (msg) => {
      if (msg.senderId === userId || msg.type === 'system') return;
      if (getActiveChatMatchId() === matchId) return;
      refresh();
    });

    return unsubscribe;
  }, [matchId, userId, refresh]);

  return { unreadCount, refresh };
}
