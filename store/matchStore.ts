import { create } from 'zustand';

import {
  ensureWelcomeNotification,
  fetchNotifications,
  markNotificationRead as markReadApi,
} from '@/services/notifications';
import { createMatch as createMatchApi, fetchMatchById, fetchMatches, addGuestToMatch as addGuestToMatchApi, removeAttendeeById as removeAttendeeByIdApi, removeAttendeeByOrganizer as removeAttendeeByOrganizerApi, RealtimeAttendeeRow, upsertAttendance } from '@/services/matches';
import { createNotification } from '@/services/notifications';
import { AttendanceStatus, Match, MatchAttendee, MatchFormat, MatchVisibility, Notification, Position } from '@/types';

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
  removeAttendeeByOrganizer: (matchId: string, userId: string) => Promise<void>;
  addGuestToMatch: (matchId: string, guestName: string, guestPosition?: Position | null) => Promise<void>;
  removeAttendeeById: (matchId: string, attendeeId: string) => Promise<void>;
  syncAttendeeFromRealtime: (row: RealtimeAttendeeRow) => void;
  removeAttendeeFromRealtime: (matchId: string, attendeeId: string) => void;
  removeMatchFromRealtime: (matchId: string) => void;
  refreshMatch: (matchId: string) => Promise<void>;
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

  removeAttendeeByOrganizer: async (matchId, userId) => {
    await removeAttendeeByOrganizerApi(matchId, userId);
    set((state) => ({
      matches: state.matches.map((match) => {
        if (match.id !== matchId) return match;
        return {
          ...match,
          attendees: match.attendees.filter((a) => a.userId !== userId),
        };
      }),
    }));
  },

  addGuestToMatch: async (matchId, guestName, guestPosition) => {
    const attendeeId = await addGuestToMatchApi(matchId, guestName, guestPosition);
    set((state) => ({
      matches: state.matches.map((match) => {
        if (match.id !== matchId) return match;
        const exists = match.attendees.some((a) => a.id === attendeeId);
        if (exists) return match;
        return {
          ...match,
          attendees: [
            ...match.attendees,
            {
              id: attendeeId,
              guestName: guestName.trim(),
              guestPosition: guestPosition ?? undefined,
              status: 'present' as const,
            },
          ],
        };
      }),
    }));
  },

  removeAttendeeById: async (matchId, attendeeId) => {
    await removeAttendeeByIdApi(attendeeId);
    set((state) => ({
      matches: state.matches.map((match) => {
        if (match.id !== matchId) return match;
        return {
          ...match,
          attendees: match.attendees.filter((a) => a.id !== attendeeId),
        };
      }),
    }));
  },

  syncAttendeeFromRealtime: (row) => {
    const attendee: MatchAttendee = {
      id: row.id,
      userId: row.user_id ?? undefined,
      guestName: row.guest_name ?? undefined,
      guestPosition: (row.guest_position as Position) ?? undefined,
      status: row.status as AttendanceStatus,
      teamId: row.team_id ?? undefined,
      joinedAt: row.created_at,
    };

    set((state) => ({
      matches: state.matches.map((match) => {
        if (match.id !== row.match_id) return match;
        const existing = match.attendees.find((a) => a.id === row.id);
        const attendees = existing
          ? match.attendees.map((a) => (a.id === row.id ? attendee : a))
          : [...match.attendees, attendee];
        return { ...match, attendees };
      }),
    }));
  },

  removeAttendeeFromRealtime: (matchId, attendeeId) => {
    set((state) => ({
      matches: state.matches.map((match) => {
        if (match.id !== matchId) return match;
        return {
          ...match,
          attendees: match.attendees.filter((a) => a.id !== attendeeId),
        };
      }),
    }));
  },

  removeMatchFromRealtime: (matchId) => {
    set((state) => ({
      matches: state.matches.filter((m) => m.id !== matchId),
    }));
  },

  refreshMatch: async (matchId) => {
    const match = await fetchMatchById(matchId);
    if (!match) {
      get().removeMatchFromRealtime(matchId);
      return;
    }

    set((state) => {
      const exists = state.matches.some((m) => m.id === matchId);
      return {
        matches: exists
          ? state.matches.map((m) => (m.id === matchId ? match : m))
          : [match, ...state.matches],
      };
    });
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
