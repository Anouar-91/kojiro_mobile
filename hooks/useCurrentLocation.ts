import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { getUserPosition, type GeoCoords } from '@/utils/geo';

export function useCurrentLocation(profileUser?: {
  latitude?: number;
  longitude?: number;
}) {
  const [position, setPosition] = useState<GeoCoords>(() => getUserPosition(profileUser));
  const [isUsingGps, setIsUsingGps] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPosition(getUserPosition(profileUser));
        setIsUsingGps(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPosition({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setIsUsingGps(true);
    } catch {
      setPosition(getUserPosition(profileUser));
      setIsUsingGps(false);
    } finally {
      setLoading(false);
    }
  }, [profileUser?.latitude, profileUser?.longitude]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { position, isUsingGps, loading, refresh };
}
