import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { SocialPost } from '@/types';

type SocialPostsListener = () => void;

type SocialPostsChannel = {
  channel: RealtimeChannel;
  listeners: Set<SocialPostsListener>;
};

let socialPostsChannel: SocialPostsChannel | null = null;

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

export function subscribeToSocialPosts(onInsert: SocialPostsListener): () => void {
  if (!socialPostsChannel) {
    const listeners = new Set<SocialPostsListener>();
    const channel = supabase
      .channel('realtime:social_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_posts' },
        () => {
          listeners.forEach((listener) => listener());
        }
      )
      .subscribe();

    socialPostsChannel = { channel, listeners };
  }

  socialPostsChannel.listeners.add(onInsert);

  return () => {
    if (!socialPostsChannel) return;

    socialPostsChannel.listeners.delete(onInsert);
    if (socialPostsChannel.listeners.size === 0) {
      supabase.removeChannel(socialPostsChannel.channel);
      socialPostsChannel = null;
    }
  };
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
