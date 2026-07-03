import { supabase } from '@/lib/supabase';
import { ChatMessage } from '@/types';

export async function fetchMessages(matchId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((m) => ({
    id: m.id,
    chatId: m.match_id,
    senderId: m.sender_id ?? 'system',
    content: m.content,
    timestamp: m.created_at,
    type: m.type as ChatMessage['type'],
  }));
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
  onMessage: (message: ChatMessage) => void
) {
  return supabase
    .channel(`messages:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => {
        const m = payload.new as {
          id: string;
          match_id: string;
          sender_id: string;
          content: string;
          type: string;
          created_at: string;
        };
        onMessage({
          id: m.id,
          chatId: m.match_id,
          senderId: m.sender_id ?? 'system',
          content: m.content,
          timestamp: m.created_at,
          type: m.type as ChatMessage['type'],
        });
      }
    )
    .subscribe();
}
