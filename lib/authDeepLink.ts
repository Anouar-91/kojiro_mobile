import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

/** Exchange a PKCE auth code from a recovery (or other) deep link into a session. */
export async function handleAuthDeepLink(url: string): Promise<boolean> {
  const parsed = Linking.parse(url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
  if (!code) return false;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn('[authDeepLink]', error.message);
    return false;
  }
  return true;
}
