/** Provider-neutral subset of Nominatim-compatible search/reverse results. */
export interface GeocodingResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  road?: string;
}

export const GEOCODING_QUERY_MIN_LENGTH = 3;
export const GEOCODING_QUERY_MAX_LENGTH = 200;
