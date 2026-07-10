import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useProfileStore } from '@/store/profileStore';
import { Match } from '@/types';

export function useRefreshMatchProfiles(match: Match | undefined) {
  const refreshProfiles = useProfileStore((s) => s.refreshProfiles);

  useFocusEffect(
    useCallback(() => {
      if (!match) return;
      const userIds = match.attendees.map((a) => a.userId).filter(Boolean) as string[];
      refreshProfiles(userIds).catch(() => {});
    }, [match, refreshProfiles])
  );
}
