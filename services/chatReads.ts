import { supabase } from '@/lib/supabase';

let activeChatMatchId: string | null = null;
const readListeners = new Set<(matchId: string) => void>();

export function onChatRead(listener: (matchId: string) => void): () => void {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
}

function notifyChatRead(matchId: string): void {
  readListeners.forEach((listener) => listener(matchId));
}

export function setActiveChatMatchId(matchId: string | null): void {
  activeChatMatchId = matchId;
}

export function getActiveChatMatchId(): string | null {
  return activeChatMatchId;
}

export async function markChatRead(matchId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('match_chat_reads').upsert(
    {
      user_id: userId,
      match_id: matchId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,match_id' }
  );
  if (error) throw new Error(error.message);
  notifyChatRead(matchId);
}

export async function markChatNotificationsRead(matchId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('type', 'chat_message')
    .filter('data->>matchId', 'eq', matchId);
  if (error) throw new Error(error.message);
}

export async function getChatUnreadCount(matchId: string, userId: string): Promise<number> {
  const { data: readRow } = await supabase
    .from('match_chat_reads')
    .select('last_read_at')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .maybeSingle();

  const since = readRow?.last_read_at ?? '1970-01-01T00:00:00Z';

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .gt('created_at', since)
    .neq('sender_id', userId)
    .neq('type', 'system');

  if (error) throw new Error(error.message);
  return count ?? 0;
}
