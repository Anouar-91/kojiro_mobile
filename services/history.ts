import { supabase } from '@/lib/supabase';
import { MatchHistory } from '@/types';

export async function fetchMatchHistory(userId: string): Promise<MatchHistory[]> {
  const { data, error } = await supabase
    .from('match_results')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    matchId: row.match_id ?? '',
    title: row.title,
    date: row.played_at,
    result: row.result,
    score: row.score,
    rating: Number(row.rating),
    goals: row.goals,
    assists: row.assists,
    mvp: row.mvp,
  }));
}

export async function addMatchResult(
  userId: string,
  result: Omit<MatchHistory, 'id'> & { matchId?: string }
): Promise<MatchHistory> {
  const { data, error } = await supabase
    .from('match_results')
    .insert({
      user_id: userId,
      match_id: result.matchId || null,
      title: result.title,
      played_at: result.date,
      result: result.result,
      score: result.score,
      rating: result.rating,
      goals: result.goals,
      assists: result.assists,
      mvp: result.mvp,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Erreur enregistrement');

  return {
    id: data.id,
    matchId: data.match_id ?? '',
    title: data.title,
    date: data.played_at,
    result: data.result,
    score: data.score,
    rating: Number(data.rating),
    goals: data.goals,
    assists: data.assists,
    mvp: data.mvp,
  };
}
