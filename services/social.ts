import { supabase } from '@/lib/supabase';
import { SocialPost } from '@/types';

export async function fetchSocialPosts(limit = 20): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapPost);
}

export async function fetchUserPosts(userId: string): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPost);
}

export interface CreatePostInput {
  authorId: string;
  type: SocialPost['type'];
  content: string;
  mediaUrl?: string;
  matchId?: string;
}

export async function createSocialPost(input: CreatePostInput): Promise<SocialPost> {
  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      author_id: input.authorId,
      type: input.type,
      content: input.content,
      media_url: input.mediaUrl ?? null,
      match_id: input.matchId ?? null,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Erreur publication');
  return mapPost(data);
}

export async function likePost(postId: string): Promise<void> {
  const { data: post } = await supabase.from('social_posts').select('likes').eq('id', postId).single();
  if (!post) return;

  await supabase
    .from('social_posts')
    .update({ likes: (post.likes ?? 0) + 1 })
    .eq('id', postId);
}

function mapPost(row: {
  id: string;
  author_id: string;
  type: string;
  content: string;
  media_url: string | null;
  match_id: string | null;
  likes: number;
  comments: number;
  created_at: string;
}): SocialPost {
  return {
    id: row.id,
    authorId: row.author_id,
    type: row.type as SocialPost['type'],
    content: row.content,
    mediaUrl: row.media_url ?? undefined,
    matchId: row.match_id ?? undefined,
    likes: row.likes,
    comments: row.comments,
    createdAt: row.created_at,
  };
}
