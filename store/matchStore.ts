import { create } from 'zustand';

import { mockMatches, mockNotifications } from '@/data/mock';
import { AttendanceStatus, Match, MatchFormat, Notification } from '@/types';

interface CreateMatchData {
  title: string;
  format: MatchFormat;
  date: string;
  time: string;
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  pricePerPlayer: number;
  description?: string;
}

interface MatchState {
  matches: Match[];
  notifications: Notification[];
  selectedMatchId: string | null;
  getMatch: (id: string) => Match | undefined;
  createMatch: (data: CreateMatchData, organizerId: string) => Match;
  updateAttendance: (matchId: string, userId: string, status: AttendanceStatus) => void;
  setSelectedMatch: (id: string | null) => void;
  markNotificationRead: (id: string) => void;
  unreadCount: () => number;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: mockMatches,
  notifications: mockNotifications,
  selectedMatchId: null,

  getMatch: (id) => get().matches.find((m) => m.id === id),

  createMatch: (data, organizerId) => {
    const newMatch: Match = {
      id: `match-${Date.now()}`,
      title: data.title || `Foot à ${data.format}`,
      format: data.format,
      date: data.date,
      time: data.time,
      location: {
        name: data.locationName,
        address: data.locationAddress,
        latitude: data.latitude,
        longitude: data.longitude,
      },
      pricePerPlayer: data.pricePerPlayer,
      description: data.description,
      organizerId,
      maxPlayers: data.format === 5 ? 10 : data.format === 7 ? 14 : 22,
      status: 'upcoming',
      attendees: [{ userId: organizerId, status: 'present' }],
      chatId: `chat-${Date.now()}`,
    };
    set((state) => ({ matches: [newMatch, ...state.matches] }));
    return newMatch;
  },

  updateAttendance: (matchId, userId, status) => {
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

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
