import { create } from 'zustand';

import { fetchAllProfiles } from '@/services/profiles';
import { Match, User } from '@/types';

interface ProfileState {
  profiles: User[];
  isLoading: boolean;
  fetchProfiles: () => Promise<void>;
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

  getProfile: (id) => get().profiles.find((p) => p.id === id),

  getOtherProfiles: (excludeId) =>
    get().profiles.filter((p) => p.id !== excludeId),
}));

export function getPresentUsersFromMatch(match: Match, getProfile: (id: string) => User | undefined): User[] {
  return match.attendees
    .filter((a) => a.status === 'present')
    .map((a) => getProfile(a.userId))
    .filter(Boolean) as User[];
}

export function getUsersByAttendance(
  match: Match,
  status: 'present' | 'maybe' | 'absent' | 'pending',
  getProfile: (id: string) => User | undefined
): User[] {
  return match.attendees
    .filter((a) => a.status === status)
    .map((a) => getProfile(a.userId))
    .filter(Boolean) as User[];
}
