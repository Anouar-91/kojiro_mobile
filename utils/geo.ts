import { GeoPlace, PARIS_CENTER } from '@/types/geo';

const EARTH_RADIUS_KM = 6371;

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function getUserPosition(user?: {
  latitude?: number;
  longitude?: number;
}): { latitude: number; longitude: number } {
  if (user?.latitude != null && user?.longitude != null) {
    return { latitude: user.latitude, longitude: user.longitude };
  }
  return PARIS_CENTER;
}

export function placeFromMatchLocation(location: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}): GeoPlace {
  return {
    name: location.name,
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}
