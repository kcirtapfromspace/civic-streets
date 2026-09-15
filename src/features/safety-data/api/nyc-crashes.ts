import type { NormalizedCrash, CrashMode, CrashSeverity, DataSourceConfig, CrashBounds, CrashDateRange, CrashFetchResult } from '@/lib/types/safety-data';

import { socrataDateFilter, validateBounds } from './validation';

const NYC_ENDPOINT = 'https://data.cityofnewyork.us/resource/h9gi-nx95.json';

interface NYCRawCrash {
  collision_id: string;
  crash_date: string;
  crash_time: string;
  latitude?: string;
  longitude?: string;
  number_of_persons_killed?: string;
  number_of_persons_injured?: string;
  number_of_pedestrians_killed?: string;
  number_of_pedestrians_injured?: string;
  number_of_cyclist_killed?: string;
  number_of_cyclist_injured?: string;
  number_of_motorist_killed?: string;
  number_of_motorist_injured?: string;
}

function normalizeCrash(raw: NYCRawCrash): NormalizedCrash | null {
  const lat = parseFloat(raw.latitude ?? '');
  const lng = parseFloat(raw.longitude ?? '');
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  const fatalities = parseInt(raw.number_of_persons_killed ?? '0', 10);
  const injuries = parseInt(raw.number_of_persons_injured ?? '0', 10);

  const modes: CrashMode[] = [];
  if (parseInt(raw.number_of_pedestrians_killed ?? '0') > 0 || parseInt(raw.number_of_pedestrians_injured ?? '0') > 0) {
    modes.push('pedestrian');
  }
  if (parseInt(raw.number_of_cyclist_killed ?? '0') > 0 || parseInt(raw.number_of_cyclist_injured ?? '0') > 0) {
    modes.push('cyclist');
  }
  if (parseInt(raw.number_of_motorist_killed ?? '0') > 0 || parseInt(raw.number_of_motorist_injured ?? '0') > 0) {
    modes.push('motorist');
  }
  if (modes.length === 0) modes.push('motorist');

  // Counts of injured people do not establish how serious their injuries were.
  let severity: CrashSeverity = 'unknown';
  if (fatalities > 0) severity = 'fatal';

  return {
    id: `nyc-${raw.collision_id}`,
    lat,
    lng,
    date: raw.crash_date?.split('T')[0] ?? '',
    modes,
    severity,
    fatalities,
    injuries,
    source: 'nyc',
  };
}

async function fetchNYCCrashes(
  bounds: CrashBounds,
  dateRange?: CrashDateRange | null,
): Promise<CrashFetchResult> {
  validateBounds(bounds);
  const where = [
    `latitude >= ${bounds.south}`,
    `latitude <= ${bounds.north}`,
    `longitude >= ${bounds.west}`,
    `longitude <= ${bounds.east}`,
    ...socrataDateFilter(dateRange),
  ].join(' AND ');

  const params = new URLSearchParams({
    $where: where,
    $limit: '1000',
    $order: 'crash_date DESC',
  });

  const res = await fetch(`${NYC_ENDPOINT}?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`NYC API ${res.status}`);

  const raw: NYCRawCrash[] = await res.json();
  if (!Array.isArray(raw)) throw new Error('NYC crash data returned an unexpected response.');
  const crashes = raw.map(normalizeCrash).filter((c): c is NormalizedCrash => c !== null);
  const warnings: string[] = [];
  if (raw.length >= 1000) warnings.push('Results may be incomplete: this source returns at most 1,000 records per view. Zoom in or shorten the date range.');
  if (crashes.length < raw.length) warnings.push(`${raw.length - crashes.length} records had no usable map coordinates.`);
  return { crashes, warnings };
}

export const nycSource: DataSourceConfig = {
  id: 'nyc',
  name: 'NYC Motor Vehicle Collisions',
  bounds: [40.4961, -74.2557, 40.9176, -73.7004], // [south, west, north, east]
  fetch: fetchNYCCrashes,
  coverage: 'municipal',
  coverageNote: 'City records only; neighboring municipalities are not included. Requests are limited to 1,000 records. Injury severity cannot be determined from injury counts, so nonfatal records use unknown severity.',
  city: 'New York City',
  citation: 'NYC OpenData, NYPD Motor Vehicle Collisions',
  dateRange: '2012–present',
  url: 'https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95',
};
