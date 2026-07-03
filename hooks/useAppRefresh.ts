import { useCallback } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';

export function useAppRefresh() {
  const userId = useAuthStore((s) => s.user?.id);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const fetchNotifications = useMatchStore((s) => s.fetchNotifications);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);

  return useCallback(async () => {
    await Promise.all([
      fetchMatches(),
      fetchProfiles(),
      refreshProfile(),
      userId ? fetchNotifications(userId) : Promise.resolve(),
    ]);
  }, [userId, fetchMatches, fetchProfiles, fetchNotifications, refreshProfile]);
}
