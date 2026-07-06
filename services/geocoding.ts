import { GeoPlace } from '@/types/geo';

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
  state?: string;
  country?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function pickCity(address?: NominatimAddress): string | undefined {
  if (!address) return undefined;
  return address.city ?? address.town ?? address.village ?? address.municipality;
}

function pickStreet(address?: NominatimAddress): string | undefined {
  if (!address) return undefined;
  const road = address.road ?? address.pedestrian ?? address.footway;
  if (!road) return undefined;
  return [address.house_number, road].filter(Boolean).join(' ');
}

export function formatFullAddress(address?: NominatimAddress, fallback?: string): string {
  if (!address) return fallback ?? '';

  const parts: string[] = [];
  const street = pickStreet(address);
  if (street) parts.push(street);

  const locality = address.suburb ?? address.neighbourhood;
  if (locality && !parts.includes(locality)) parts.push(locality);

  const city = pickCity(address);
  const cityLine = [address.postcode, city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);

  if (parts.length > 0) return parts.join(', ');
  return fallback ?? '';
}

function mapCityResult(item: NominatimResult): GeoPlace {
  const city = pickCity(item.address);
  const shortName = item.name ?? city ?? item.display_name.split(',')[0];
  return {
    name: shortName,
    address: formatFullAddress(item.address, item.display_name) || item.display_name,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    city,
  };
}

function mapVenueResult(item: NominatimResult): GeoPlace {
  const city = pickCity(item.address);
  const street = pickStreet(item.address);
  const poiName = item.name?.trim();
  const isPoi = poiName && poiName.toLowerCase() !== city?.toLowerCase();

  const name = isPoi ? poiName : street ?? poiName ?? city ?? item.display_name.split(',')[0];
  const address = formatFullAddress(item.address, item.display_name) || item.display_name;

  return {
    name,
    address,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    city,
  };
}

export async function searchPlaces(query: string, limit = 8): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'fr',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'KojiroApp/1.0 (football-mobile-app)' },
  });

  if (!response.ok) throw new Error('Recherche de lieu indisponible');

  const data = (await response.json()) as NominatimResult[];
  return data.map(mapVenueResult);
}

export async function searchCities(query: string, limit = 5): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'fr',
    featuretype: 'city',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'KojiroApp/1.0 (football-mobile-app)' },
  });

  if (!response.ok) throw new Error('Recherche de ville indisponible');

  const data = (await response.json()) as NominatimResult[];
  return data.map(mapCityResult);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  mode: 'venue' | 'city' = 'venue'
): Promise<GeoPlace | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'User-Agent': 'KojiroApp/1.0 (football-mobile-app)' },
  });

  if (!response.ok) return null;

  const item = (await response.json()) as NominatimResult;
  if (!item?.lat) return null;
  return mode === 'city' ? mapCityResult(item) : mapVenueResult(item);
}

export function getPlaceDisplayText(place: GeoPlace, mode: 'venue' | 'city'): string {
  if (mode === 'city') return place.name;
  if (place.address && place.address !== place.name) {
    return place.name ? `${place.name}, ${place.address}` : place.address;
  }
  return place.address || place.name;
}
