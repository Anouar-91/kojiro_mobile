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

export async function fetchAllProfiles(limit = 100): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name')
    .limit(limit);
  if (error || !data) return [];
  return data.map(mapProfileToUser);
}

export async function searchProfiles(query: string, limit = 30): Promise<User[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const pattern = `%${q.replace(/[%_]/g, '')}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`name.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`)
    .order('name')
    .limit(limit);

  if (error || !data) return [];
  return data.map(mapProfileToUser);
}
