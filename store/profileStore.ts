import { create } from 'zustand';

import { fetchAllProfiles, fetchProfile } from '@/services/profiles';
import { Match, User } from '@/types';
import { attendeeToDisplayUser, uniqueUsersById } from '@/utils/guestAttendees';

interface ProfileState {
  profiles: User[];
  isLoading: boolean;
  fetchProfiles: () => Promise<void>;
  ensureProfile: (userId: string) => Promise<void>;
  upsertProfile: (profile: User) => void;
  refreshProfile: (userId: string) => Promise<void>;
  refreshProfiles: (userIds: string[]) => Promise<void>;
  getProfile: (id: string) => User | undefined;
  getOtherProfiles: (excludeId?: string) => User[];
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  isLoading: false,

  fetchProfiles: async () => {
    set({ isLoading: true });
    try {
      const profiles = await fetchAllProfiles();
      set({ profiles, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  ensureProfile: async (userId) => {
    if (get().profiles.some((p) => p.id === userId)) return;
    await get().refreshProfile(userId);
  },

  upsertProfile: (profile) => {
    set((state) => {
      const idx = state.profiles.findIndex((p) => p.id === profile.id);
      if (idx === -1) return { profiles: [...state.profiles, profile] };
      const next = [...state.profiles];
      next[idx] = profile;
      return { profiles: next };
    });
  },

  refreshProfile: async (userId) => {
    const profile = await fetchProfile(userId);
    if (profile) get().upsertProfile(profile);
  },

  refreshProfiles: async (userIds) => {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return;

    const results = await Promise.all(unique.map((id) => fetchProfile(id)));
    const fresh = results.filter(Boolean) as User[];
    if (fresh.length === 0) return;

    set((state) => {
      const map = new Map(state.profiles.map((p) => [p.id, p]));
      fresh.forEach((p) => map.set(p.id, p));
      return { profiles: [...map.values()] };
    });
  },

  getProfile: (id) => get().profiles.find((p) => p.id === id),

  getOtherProfiles: (excludeId) =>
    get().profiles.filter((p) => p.id !== excludeId),
}));

export function getPresentUsersFromMatch(match: Match, getProfile: (id: string) => User | undefined): User[] {
  return uniqueUsersById(
    match.attendees
      .filter((a) => a.status === 'present')
      .map((a) => attendeeToDisplayUser(a, getProfile))
      .filter(Boolean) as User[]
  );
}

export function getUsersByAttendance(
  match: Match,
  status: 'present' | 'maybe' | 'absent' | 'pending' | 'waitlist',
  getProfile: (id: string) => User | undefined
): User[] {
  const attendees =
    status === 'waitlist'
      ? match.attendees
          .filter((a) => a.status === 'waitlist')
          .sort((a, b) => {
            const ta = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
            const tb = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
            return ta - tb;
          })
      : match.attendees.filter((a) => a.status === status);

  return uniqueUsersById(
    attendees.map((a) => attendeeToDisplayUser(a, getProfile)).filter(Boolean) as User[]
  );
}
