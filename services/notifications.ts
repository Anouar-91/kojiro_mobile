import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';

function mapNotification(row: {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, string> | null;
  created_at: string;
}): Notification {
  return {
    id: row.id,
    type: row.type as Notification['type'],
    title: row.title,
    body: row.body,
    read: row.read,
    data: row.data ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function createNotification(
  userId: string,
  notification: Pick<Notification, 'type' | 'title' | 'body' | 'data'>
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? null,
  });
  if (error) throw new Error(error.message);
}

export function subscribeToNotifications(userId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => onInsert()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function ensureWelcomeNotification(userId: string): Promise<void> {
  const existing = await fetchNotifications(userId);
  if (existing.length > 0) return;

  await createNotification(userId, {
    type: 'social',
    title: 'Bienvenue sur Kojiro ! ⚽',
    body: 'Crée ton premier match et invite tes amis à rejoindre.',
  });
}
