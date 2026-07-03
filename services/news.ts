import { supabase } from '@/lib/supabase';
import { NewsItem } from '@/types';

export async function fetchNews(): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    imageUrl: row.image_url,
    category: row.category,
    publishedAt: row.published_at,
  }));
}
