import { supabase } from '@/lib/supabase';

export async function invitePlayerToMatch(matchId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('invite_to_match', {
    p_match_id: matchId,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
}
