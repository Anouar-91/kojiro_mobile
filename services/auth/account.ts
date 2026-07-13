import { supabase } from '@/lib/supabase';

export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw new Error(error.message);
}
