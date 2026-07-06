import { supabase } from '@/lib/supabase';

export async function uploadHighlightMedia(
  userId: string,
  localUri: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes('video') ? 'mp4' : mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from('highlights').upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('highlights').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  return uploadHighlightMedia(userId, localUri, 'image/jpeg');
}
