import { useEffect, useState } from 'react';

import { useMatchStore } from '@/store/matchStore';
import { Match } from '@/types';

/** Charge le match par id s'il n'est pas déjà dans le store (ex. deep link / refresh). */
export function useEnsureMatch(id: string | undefined): {
  match: Match | undefined;
  loading: boolean;
} {
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const refreshMatch = useMatchStore((s) => s.refreshMatch);
  const [loading, setLoading] = useState(Boolean(id) && !match);

  useEffect(() => {
    if (!id || match) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    refreshMatch(id)
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, match, refreshMatch]);

  return { match, loading };
}
