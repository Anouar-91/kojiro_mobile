import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { currentUser } from '@/data/mock';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithProvider: (provider: 'google' | 'apple') => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, _password: string) => {
        set({ isLoading: true });
        await new Promise((r) => setTimeout(r, 800));
        set({
          user: { ...currentUser, email },
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      },

      loginWithProvider: async (_provider: 'google' | 'apple') => {
        set({ isLoading: true });
        await new Promise((r) => setTimeout(r, 1000));
        set({
          user: currentUser,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      },

      register: async (email: string, _password: string, name: string) => {
        set({ isLoading: true });
        await new Promise((r) => setTimeout(r, 800));
        set({
          user: { ...currentUser, email, name, level: 1, xp: 0, stats: { ...currentUser.stats, matchesPlayed: 0, goals: 0, assists: 0, wins: 0, losses: 0, draws: 0, mvpCount: 0 } },
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      updateUser: (updates: Partial<User>) => {
        const { user } = get();
        if (user) set({ user: { ...user, ...updates } });
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
