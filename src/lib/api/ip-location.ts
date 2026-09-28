/** Approximate startup area only: never use this for report pins or jurisdiction. */
export interface ApproximateLocation {
  center: { lat: number; lng: number };
  label: string;
  zoom: number;
}

const GEOJS_URL = 'https://get.geojs.io/v1/ip/geo.json';

export async function fetchApproximateLocation(): Promise<ApproximateLocation | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(GEOJS_URL, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const row = data as Record<string, unknown>;
    // GeoJS coordinates are strings. Reject blank/malformed values, not just NaN.
    if (typeof row.latitude !== 'string' || !row.latitude.trim()
      || typeof row.longitude !== 'string' || !row.longitude.trim()) return null;
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!Number.isFinite(lat) || Math.abs(lat) > 85
      || !Number.isFinite(lng) || Math.abs(lng) > 180) return null;
    const city = typeof row.city === 'string' ? row.city.trim().slice(0, 100) : '';
    const region = typeof row.region === 'string' ? row.region.trim().slice(0, 100) : '';
    if (row.accuracy !== undefined && (typeof row.accuracy !== 'number'
      || !Number.isFinite(row.accuracy) || row.accuracy < 0)) return null;
    // Country-only answers can put a visitor hundreds of miles away. Use the fallback.
    if (!city || (typeof row.accuracy === 'number' && row.accuracy > 100)) return null;
    return {
      center: { lat, lng },
      label: region ? `${city}, ${region}` : city,
      zoom: typeof row.accuracy === 'number' && row.accuracy > 25 ? 9 : 11,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
