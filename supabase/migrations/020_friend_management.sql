-- Migration 020 : suppression d'amitié / annulation de demande
-- Exécuter dans Supabase SQL Editor

DROP POLICY IF EXISTS "friend_requests_delete_involved" ON public.friend_requests;
CREATE POLICY "friend_requests_delete_involved" ON public.friend_requests
  FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

NOTIFY pgrst, 'reload schema';
