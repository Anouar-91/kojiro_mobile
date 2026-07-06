import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({ scheme: 'kojiro', path: 'auth/callback' });

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;

  if (!access_token || !refresh_token) {
    throw new Error('Connexion OAuth incomplète. Vérifie la config Supabase (Redirect URLs).');
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error) throw new Error(error.message);
  if (!data.url) throw new Error('URL OAuth Google indisponible');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Connexion Google annulée');

  await createSessionFromUrl(result.url);
}

export async function signInWithApple(): Promise<void> {
  if (Platform.OS === 'ios') {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) throw new Error('Apple Sign-In non disponible sur cet appareil');

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Token Apple manquant');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;
    return;
  }

  // Android / Web : OAuth via navigateur
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) throw new Error(error.message);
  if (!data.url) throw new Error('URL OAuth Apple indisponible');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Connexion Apple annulée');

  await createSessionFromUrl(result.url);
}

export function getOAuthRedirectUri(): string {
  return redirectTo;
}
