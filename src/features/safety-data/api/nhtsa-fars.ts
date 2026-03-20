import type { NormalizedCrash, CrashMode, DataSourceConfig } from '@/lib/types/safety-data';

const FARS_ENDPOINT = 'https://crashviewer.nhtsa.dot.gov/CrashAPI/crashes/GetCrashesByLocation';

interface FARSRawCrash {
  CaseYear: number;
  ST_CASE: number;
  LATITUDE: number;
  LONGITUD: number;
  FATALS: number;
  DRUNK_DR: number;
  PEDS: number;
  PERSONS: number;
  MONTH: number;
  DAY: number;
}

function normalizeFARS(raw: FARSRawCrash): NormalizedCrash | null {
  const lat = raw.LATITUDE;
  const lng = raw.LONGITUD;
  if (!lat || !lng || lat === 0 || lng === 0 || lat > 90 || lat < -90) return null;

  const modes: CrashMode[] = ['motorist'];
  if (raw.PEDS > 0) modes.unshift('pedestrian');

  const month = String(raw.MONTH).padStart(2, '0');
  const day = String(raw.DAY).padStart(2, '0');

  return {
    id: `fars-${raw.CaseYear}-${raw.ST_CASE}`,
    lat,
    lng,
    date: `${raw.CaseYear}-${month}-${day}`,
    modes,
    severity: 'fatal',
    fatalities: raw.FATALS,
    injuries: 0,
    source: 'fars',
  };
}

async function fetchFARSCrashes(
  bounds: { south: number; west: number; north: number; east: number },
): Promise<NormalizedCrash[]> {
  // FARS API takes center + radius, so compute from bounds
  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLng = (bounds.west + bounds.east) / 2;

  // Approximate radius in miles
  const latDiff = bounds.north - bounds.south;
  const lngDiff = bounds.east - bounds.west;
  const radiusMiles = Math.min(
    Math.max(latDiff * 69, lngDiff * 54.6) / 2,
    10, // Cap at 10 miles
  );

  const params = new URLSearchParams({
    fromCaseYear: '2020',
    toCaseYear: '2023',
    state: '0', // All states
    lat: centerLat.toFixed(6),
    lng: centerLng.toFixed(6),
    radius: radiusMiles.toFixed(1),
    format: 'json',
  });

  try {
    const res = await fetch(`${FARS_ENDPOINT}?${params}`);
    if (!res.ok) throw new Error(`FARS API ${res.status}`);

    const data = await res.json();
    const results = data?.Results?.[0] ?? [];
    if (!Array.isArray(results)) return [];

    return results
      .map((r: FARSRawCrash) => normalizeFARS(r))
      .filter((c): c is NormalizedCrash => c !== null);
  } catch {
    return [];
  }
}

export const farsSource: DataSourceConfig = {
  id: 'fars',
  name: 'NHTSA FARS (Fatal Crashes)',
  bounds: [24.396, -125.0, 49.384, -66.934], // Continental US
  fetch: fetchFARSCrashes,
};
