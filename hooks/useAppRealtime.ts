import { useEffect } from 'react';

import { subscribeToFriendRequests } from '@/services/friends';
import { subscribeToMatchAttendees, subscribeToMatches } from '@/services/matches';
import { subscribeToProfiles } from '@/services/profiles';
import { useFriendStore } from '@/store/friendStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';

export function useAppRealtime(userId: string | undefined) {
  const syncAttendee = useMatchStore((s) => s.syncAttendeeFromRealtime);
  const removeAttendee = useMatchStore((s) => s.removeAttendeeFromRealtime);
  const refreshMatch = useMatchStore((s) => s.refreshMatch);
  const fetchMatches = useMatchStore((s) => s.fetchMatches);
  const ensureProfile = useProfileStore((s) => s.ensureProfile);
  const upsertProfile = useProfileStore((s) => s.upsertProfile);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);

  useEffect(() => {
    if (!userId) return;

    const unsubAttendees = subscribeToMatchAttendees({
      onUpsert: (row) => {
        syncAttendee(row);
        if (row.user_id) {
          ensureProfile(row.user_id).catch(() => {});
        }
      },
      onDelete: (row) => {
        removeAttendee(row.match_id, row.attendee_id);
      },
    });

    const unsubMatches = subscribeToMatches({
      onChange: (matchId) => {
        refreshMatch(matchId).catch(() => {});
      },
      onInsert: () => {
        fetchMatches(userId).catch(() => {});
      },
    });

    const unsubFriends = subscribeToFriendRequests(() => {
      fetchFriends(userId).catch(() => {});
    });

    const unsubProfiles = subscribeToProfiles((profile) => {
      upsertProfile(profile);
    });

    return () => {
      unsubAttendees();
      unsubMatches();
      unsubFriends();
      unsubProfiles();
    };
  }, [
    userId,
    syncAttendee,
    removeAttendee,
    refreshMatch,
    fetchMatches,
    ensureProfile,
    upsertProfile,
    fetchFriends,
  ]);
}
