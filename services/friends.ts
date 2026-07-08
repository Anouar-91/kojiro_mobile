import { supabase } from '@/lib/supabase';
import { FriendRequest } from '@/types';

function mapRequest(row: {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
}): FriendRequest {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status as FriendRequest['status'],
    createdAt: row.created_at,
  };
}

export async function fetchFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('from_user_id, to_user_id')
    .eq('status', 'accepted')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    row.from_user_id === userId ? row.to_user_id : row.from_user_id
  );
}

export async function fetchFriendRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRequest);
}

export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) throw new Error('Tu ne peux pas t\'ajouter toi-même');

  const { data: reverse } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('from_user_id', toUserId)
    .eq('to_user_id', fromUserId)
    .maybeSingle();

  if (reverse?.status === 'pending') {
    await acceptFriendRequest(reverse.id);
    return;
  }

  if (reverse?.status === 'accepted') {
    throw new Error('Vous êtes déjà amis');
  }

  const { data: existing } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('from_user_id', fromUserId)
    .eq('to_user_id', toUserId)
    .maybeSingle();

  if (existing?.status === 'accepted') throw new Error('Vous êtes déjà amis');
  if (existing?.status === 'pending') throw new Error('Demande déjà envoyée');

  const { error } = await supabase.from('friend_requests').upsert(
    {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: 'pending',
    },
    { onConflict: 'from_user_id,to_user_id' }
  );

  if (error) throw new Error(error.message);
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  if (error) throw new Error(error.message);
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'declined' })
    .eq('id', requestId);

  if (error) throw new Error(error.message);
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

export async function removeFriend(userId: string, friendUserId: string): Promise<void> {
  const { data: rows, error: fetchError } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(from_user_id.eq.${userId},to_user_id.eq.${friendUserId}),and(from_user_id.eq.${friendUserId},to_user_id.eq.${userId})`
    );

  if (fetchError) throw new Error(fetchError.message);

  const row = rows?.[0];
  if (!row) throw new Error('Cette personne n\'est pas dans tes amis');

  const { error } = await supabase.from('friend_requests').delete().eq('id', row.id);
  if (error) throw new Error(error.message);
}

export type FriendshipState = 'none' | 'friends' | 'pending_sent' | 'pending_received';

export function getFriendshipState(
  userId: string,
  otherUserId: string,
  requests: FriendRequest[]
): FriendshipState {
  const between = requests.filter(
    (r) =>
      (r.fromUserId === userId && r.toUserId === otherUserId) ||
      (r.fromUserId === otherUserId && r.toUserId === userId)
  );

  if (between.some((r) => r.status === 'accepted')) return 'friends';

  const pending = between.find((r) => r.status === 'pending');
  if (pending) {
    return pending.fromUserId === userId ? 'pending_sent' : 'pending_received';
  }

  return 'none';
}

export function subscribeToFriendRequests(onChange: () => void): () => void {
  const channel = supabase
    .channel('realtime:friend_requests')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'friend_requests' },
      () => onChange()
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'friend_requests' },
      () => onChange()
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'friend_requests' },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
