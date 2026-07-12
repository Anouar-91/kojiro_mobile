import { supabase } from '@/lib/supabase';

export interface MatchInviteSuggestion {
  id: string;
  matchId: string;
  suggestedUserId: string;
  suggestedByUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

function mapSuggestion(row: {
  id: string;
  match_id: string;
  suggested_user_id: string;
  suggested_by_user_id: string;
  status: string;
  created_at: string;
}): MatchInviteSuggestion {
  return {
    id: row.id,
    matchId: row.match_id,
    suggestedUserId: row.suggested_user_id,
    suggestedByUserId: row.suggested_by_user_id,
    status: row.status as MatchInviteSuggestion['status'],
    createdAt: row.created_at,
  };
}

export async function invitePlayerToMatch(matchId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('invite_to_match', {
    p_match_id: matchId,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
}

export async function suggestPlayerToMatch(matchId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('suggest_player_to_match', {
    p_match_id: matchId,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
}

export async function approveMatchSuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_match_suggestion', {
    p_suggestion_id: suggestionId,
  });

  if (error) throw new Error(error.message);
}

export async function rejectMatchSuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_match_suggestion', {
    p_suggestion_id: suggestionId,
  });

  if (error) throw new Error(error.message);
}

export async function fetchPendingSuggestions(matchId: string): Promise<MatchInviteSuggestion[]> {
  const { data, error } = await supabase
    .from('match_invite_suggestions')
    .select('*')
    .eq('match_id', matchId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSuggestion);
}
