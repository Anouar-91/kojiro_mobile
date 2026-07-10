import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { ChatMessage } from '@/types';

type MessageListener = (message: ChatMessage) => void;

type MessageChannel = {
  channel: RealtimeChannel;
  listeners: Set<MessageListener>;
};

const messageChannels = new Map<string, MessageChannel>();

export const CHAT_PAGE_SIZE = 50;

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string | null;
  content: string;
  type: string;
  created_at: string;
};

function mapRowToMessage(m: MessageRow): ChatMessage {
  return {
    id: m.id,
    chatId: m.match_id,
    senderId: m.sender_id ?? 'system',
    content: m.content,
    timestamp: m.created_at,
    type: m.type as ChatMessage['type'],
  };
}

function sortMessagesAsc(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export async function fetchRecentMessages(
  matchId: string,
  limit = CHAT_PAGE_SIZE,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return sortMessagesAsc((data ?? []).map(mapRowToMessage));
}

export async function fetchOlderMessages(
  matchId: string,
  beforeCreatedAt: string,
  limit = CHAT_PAGE_SIZE,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .lt('created_at', beforeCreatedAt)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return sortMessagesAsc((data ?? []).map(mapRowToMessage));
}

export async function sendMessage(
  matchId: string,
  senderId: string,
  content: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, content, type: 'text' })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Erreur envoi message');

  return {
    id: data.id,
    chatId: data.match_id,
    senderId: data.sender_id,
    content: data.content,
    timestamp: data.created_at,
    type: 'text',
  };
}

export function subscribeToMessages(
  matchId: string,
  onMessage: MessageListener
): () => void {
  let entry = messageChannels.get(matchId);

  if (!entry) {
    const listeners = new Set<MessageListener>();
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const msg = mapRowToMessage(
            payload.new as {
              id: string;
              match_id: string;
              sender_id: string | null;
              content: string;
              type: string;
              created_at: string;
            }
          );
          listeners.forEach((listener) => listener(msg));
        }
      )
      .subscribe();

    entry = { channel, listeners };
    messageChannels.set(matchId, entry);
  }

  entry.listeners.add(onMessage);

  return () => {
    const current = messageChannels.get(matchId);
    if (!current) return;

    current.listeners.delete(onMessage);
    if (current.listeners.size === 0) {
      supabase.removeChannel(current.channel);
      messageChannels.delete(matchId);
    }
  };
}
