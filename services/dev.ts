import { supabase } from '@/lib/supabase';

export interface DevFillMatchResult {
  added: number;
  present: number;
  target: number;
  message: string;
}

export async function devFillMatchAttendees(
  matchId: string,
  targetPresent: number
): Promise<DevFillMatchResult> {
  const { data, error } = await supabase.rpc('dev_fill_match_attendees', {
    p_match_id: matchId,
    p_target_present: targetPresent,
  });

  if (error) throw new Error(error.message);

  const result = data as DevFillMatchResult;
  return {
    added: result.added ?? 0,
    present: result.present ?? 0,
    target: result.target ?? targetPresent,
    message: result.message ?? 'Terminé',
  };
}
