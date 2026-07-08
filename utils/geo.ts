import { GeoPlace, PARIS_CENTER } from '@/types/geo';

export type GeoCoords = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;

/** Rayon max pour les matchs « à proximité » (accueil + carte). */
export const NEARBY_MATCH_RADIUS_KM = 10;
export const WIDER_MATCH_RADIUS_KM = 25;

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

export function sortByProximity<T>(
  items: T[],
  userPosition: GeoCoords,
  getCoords: (item: T) => GeoCoords,
  maxRadiusKm = NEARBY_MATCH_RADIUS_KM
): { item: T; distance: number }[] {
  return items
    .map((item) => ({
      item,
      distance: distanceKm(userPosition, getCoords(item)),
    }))
    .filter(({ distance }) => distance <= maxRadiusKm)
    .sort((a, b) => a.distance - b.distance);
}

export function getUserPosition(user?: {
  latitude?: number;
  longitude?: number;
}): GeoCoords {
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
