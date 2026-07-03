/**
 * Service layer — prêt pour intégration backend (Supabase, Firebase, REST API).
 * Remplacez les implémentations mock par des appels réseau en production.
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.kojiro.app';

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
