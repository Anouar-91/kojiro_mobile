-- Migration 004 : social posts + storage highlights
-- Exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'photo' CHECK (type IN ('photo', 'video', 'result')),
  content TEXT NOT NULL,
  media_url TEXT,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_posts_select_all" ON public.social_posts;
CREATE POLICY "social_posts_select_all" ON public.social_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "social_posts_insert_own" ON public.social_posts;
CREATE POLICY "social_posts_insert_own" ON public.social_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "social_posts_update_own" ON public.social_posts;
CREATE POLICY "social_posts_update_own" ON public.social_posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_created ON public.social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_author ON public.social_posts(author_id);

-- Storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'highlights',
  'highlights',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DROP POLICY IF EXISTS "highlights_public_read" ON storage.objects;
CREATE POLICY "highlights_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'highlights');

DROP POLICY IF EXISTS "highlights_auth_upload" ON storage.objects;
CREATE POLICY "highlights_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'highlights'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "highlights_auth_delete" ON storage.objects;
CREATE POLICY "highlights_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'highlights'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
