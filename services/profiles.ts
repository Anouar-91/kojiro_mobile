import { mapProfileToUser } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';

export async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return mapProfileToUser(data);
}

export async function updateProfile(userId: string, updates: Record<string, unknown>): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Erreur mise à jour profil');
  return mapProfileToUser(data);
}

export async function fetchAllProfiles(): Promise<User[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name');
  if (error || !data) return [];
  return data.map(mapProfileToUser);
}
