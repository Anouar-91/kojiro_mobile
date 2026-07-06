import { create } from 'zustand';

import {
  ensureWelcomeNotification,
  fetchNotifications,
  markNotificationRead as markReadApi,
} from '@/services/notifications';
import { createMatch as createMatchApi, fetchMatches, upsertAttendance } from '@/services/matches';
import { createNotification } from '@/services/notifications';
import { AttendanceStatus, Match, MatchFormat, MatchVisibility, Notification } from '@/types';

interface CreateMatchData {
  title: string;
  format: MatchFormat;
  substitutesPerTeam?: number;
  date: string;
  time: string;
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  pricePerPlayer: number;
  description?: string;
  visibility?: MatchVisibility;
}

interface MatchState {
  matches: Match[];
  notifications: Notification[];
  selectedMatchId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchMatches: (userId?: string) => Promise<void>;
  fetchNotifications: (userId: string) => Promise<void>;
  getMatch: (id: string) => Match | undefined;
  createMatch: (data: CreateMatchData, organizerId: string) => Promise<Match>;
  updateAttendance: (matchId: string, userId: string, status: AttendanceStatus) => Promise<void>;
  setSelectedMatch: (id: string | null) => void;
  markNotificationRead: (id: string) => Promise<void>;
  unreadCount: () => number;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  notifications: [],
  selectedMatchId: null,
  isLoading: false,
  error: null,

  fetchMatches: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const matches = await fetchMatches(userId);
      set({ matches, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Erreur chargement matchs',
      });
    }
  },

  fetchNotifications: async (userId) => {
    try {
      await ensureWelcomeNotification(userId);
      const notifications = await fetchNotifications(userId);
      set({ notifications });
    } catch {
      // silencieux si table pas encore migrée
    }
  },

  getMatch: (id) => get().matches.find((m) => m.id === id),

  createMatch: async (data, organizerId) => {
    const match = await createMatchApi({ ...data, organizerId });
    set((state) => ({ matches: [match, ...state.matches] }));
    try {
      await createNotification(organizerId, {
        type: 'match_reminder',
        title: 'Match créé !',
        body: `"${match.title}" est prêt. Invite des joueurs !`,
        data: { matchId: match.id },
      });
      await get().fetchNotifications(organizerId);
    } catch {
      // notification optionnelle
    }
    return match;
  },

  updateAttendance: async (matchId, userId, status) => {
    await upsertAttendance(matchId, userId, status);
    set((state) => ({
      matches: state.matches.map((match) => {
        if (match.id !== matchId) return match;
        const existing = match.attendees.find((a) => a.userId === userId);
        const attendees = existing
          ? match.attendees.map((a) => (a.userId === userId ? { ...a, status } : a))
          : [...match.attendees, { userId, status }];
        return { ...match, attendees };
      }),
    }));
  },

  setSelectedMatch: (id) => set({ selectedMatchId: id }),

  markNotificationRead: async (id) => {
    await markReadApi(id);
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
