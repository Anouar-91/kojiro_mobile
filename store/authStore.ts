import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mapProfileToUser, userToProfileUpdate } from '@/lib/mappers';
import { supabase } from '@/lib/supabase';
import { signInWithApple, signInWithGoogle } from '@/services/auth/oauth';
import { fetchProfile, updateProfile } from '@/services/profiles';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithProvider: (provider: 'google' | 'apple') => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function getAuthErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect';
  if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email';
  if (message.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères';
  return message;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            let profile = await fetchProfile(session.user.id);
            if (!profile) {
              await new Promise((r) => setTimeout(r, 500));
              profile = await fetchProfile(session.user.id);
            }
            if (profile) {
              set({ user: profile, isAuthenticated: true });
            }
          }
        } finally {
          set({ isInitialized: true });
        }

        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            if (profile) set({ user: profile, isAuthenticated: true });
          } else {
            set({ user: null, isAuthenticated: false });
          }
        });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw new Error(getAuthErrorMessage(error.message));

          const profile = await fetchProfile(data.user.id);
          if (!profile) throw new Error('Profil introuvable');

          set({ user: profile, isAuthenticated: true, isLoading: false });
          return true;
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      loginWithProvider: async (provider) => {
        set({ isLoading: true });
        try {
          if (provider === 'google') {
            await signInWithGoogle();
          } else {
            await signInWithApple();
          }

          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) throw new Error('Session invalide après connexion sociale');

          let profile = await fetchProfile(session.user.id);
          if (!profile) {
            const meta = session.user.user_metadata ?? {};
            await supabase.from('profiles').upsert({
              id: session.user.id,
              email: session.user.email ?? '',
              name: meta.full_name ?? meta.name ?? 'Joueur',
              avatar: meta.avatar_url ?? meta.picture ?? '',
            });
            profile = await fetchProfile(session.user.id);
          }

          if (!profile) throw new Error('Profil introuvable');

          set({ user: profile, isAuthenticated: true, isLoading: false });
          return true;
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
          });
          if (error) throw new Error(getAuthErrorMessage(error.message));
          if (!data.user) throw new Error('Inscription échouée');

          if (!data.session) {
            set({ isLoading: false });
            throw new Error(
              'Compte créé ! Vérifie ton email pour confirmer, ou désactive la confirmation email dans Supabase (Auth → Providers → Email).'
            );
          }

          await new Promise((r) => setTimeout(r, 800));
          let profile = await fetchProfile(data.user.id);

          if (!profile) {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email,
              name,
            });
            profile = await fetchProfile(data.user.id);
          }

          if (!profile) throw new Error('Profil introuvable après inscription');

          set({ user: profile, isAuthenticated: true, isLoading: false });
          return true;
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false });
      },

      updateUser: async (updates) => {
        const { user } = get();
        if (!user) return;

        const dbUpdates = userToProfileUpdate(updates);
        const updated = await updateProfile(user.id, dbUpdates);
        if (updated) set({ user: updated });
      },

      refreshProfile: async () => {
        const { user } = get();
        if (!user) return;
        const profile = await fetchProfile(user.id);
        if (profile) set({ user: profile });
      },
    }),
    {
      name: 'kojiro-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
