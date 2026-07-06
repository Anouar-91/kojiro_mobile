export interface GeoPlace {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  city?: string;
}

export const PARIS_CENTER = { latitude: 48.8566, longitude: 2.3522 };
