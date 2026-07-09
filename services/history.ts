import { supabase } from '@/lib/supabase';
import { MatchHistory, MatchRecap } from '@/types';

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
    fairPlay: Number(row.fair_play ?? 4),
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
      fair_play: result.fairPlay ?? 4,
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
    fairPlay: Number(data.fair_play ?? 4),
    goals: data.goals,
    assists: data.assists,
    mvp: data.mvp,
  };
}

export async function fetchMatchRecap(matchId: string): Promise<MatchRecap> {
  const { data, error } = await supabase.rpc('get_match_recap', { p_match_id: matchId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Résumé introuvable');

  const recap = data as Record<string, unknown>;
  const players = (recap.players as Record<string, unknown>[]) ?? [];

  return {
    matchId: recap.matchId as string,
    title: recap.title as string,
    date: recap.date as string,
    locationName: recap.locationName as string,
    format: recap.format as number,
    score: recap.score as string,
    teamAScore: Number(recap.teamAScore ?? 0),
    teamBScore: Number(recap.teamBScore ?? 0),
    mvp: (recap.mvp as MatchRecap['mvp']) ?? null,
    players: players.map((p) => ({
      userId: p.userId as string,
      name: p.name as string,
      avatarUrl: (p.avatarUrl as string | null) ?? null,
      team: p.team as 'A' | 'B',
      goals: Number(p.goals ?? 0),
      assists: Number(p.assists ?? 0),
      rating: Number(p.rating ?? 4),
      fairPlay: Number(p.fairPlay ?? 4),
      mvp: Boolean(p.mvp),
      result: p.result as string,
    })),
  };
}
