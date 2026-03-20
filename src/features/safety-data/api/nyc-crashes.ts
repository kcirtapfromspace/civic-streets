import type { NormalizedCrash, CrashMode, CrashSeverity, DataSourceConfig } from '@/lib/types/safety-data';

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

  let severity: CrashSeverity = 'minor';
  if (fatalities > 0) severity = 'fatal';
  else if (injuries >= 3) severity = 'severe-injury';
  else if (injuries >= 1) severity = 'moderate-injury';

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
  bounds: { south: number; west: number; north: number; east: number },
): Promise<NormalizedCrash[]> {
  const where = [
    `latitude >= ${bounds.south}`,
    `latitude <= ${bounds.north}`,
    `longitude >= ${bounds.west}`,
    `longitude <= ${bounds.east}`,
  ].join(' AND ');

  const params = new URLSearchParams({
    $where: where,
    $limit: '1000',
    $order: 'crash_date DESC',
  });

  const res = await fetch(`${NYC_ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`NYC API ${res.status}`);

  const raw: NYCRawCrash[] = await res.json();
  return raw.map(normalizeCrash).filter((c): c is NormalizedCrash => c !== null);
}

export const nycSource: DataSourceConfig = {
  id: 'nyc',
  name: 'NYC Motor Vehicle Collisions',
  bounds: [40.4961, -74.2557, 40.9176, -73.7004], // [south, west, north, east]
  fetch: fetchNYCCrashes,
};
