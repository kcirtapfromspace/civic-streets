import type { NormalizedCrash, CrashMode, CrashSeverity, DataSourceConfig } from '@/lib/types/safety-data';

const CHI_ENDPOINT = 'https://data.cityofchicago.org/resource/85ca-t3if.json';

interface ChicagoRawCrash {
  crash_record_id: string;
  crash_date: string;
  latitude?: string;
  longitude?: string;
  injuries_fatal?: string;
  injuries_total?: string;
  injuries_incapacitating?: string;
  most_severe_injury?: string;
  first_crash_type?: string;
}

function normalizeCrash(raw: ChicagoRawCrash): NormalizedCrash | null {
  const lat = parseFloat(raw.latitude ?? '');
  const lng = parseFloat(raw.longitude ?? '');
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  const fatalities = parseInt(raw.injuries_fatal ?? '0', 10);
  const injuries = parseInt(raw.injuries_total ?? '0', 10);

  // Mode detection via first_crash_type
  const crashType = (raw.first_crash_type ?? '').toUpperCase();
  const modes: CrashMode[] = [];
  if (crashType === 'PEDESTRIAN') modes.push('pedestrian');
  else if (crashType === 'PEDALCYCLIST') modes.push('cyclist');
  else modes.push('motorist');

  // Severity from most_severe_injury enum
  let severity: CrashSeverity = 'minor';
  const sevField = (raw.most_severe_injury ?? '').toUpperCase();
  if (sevField === 'FATAL') severity = 'fatal';
  else if (sevField === 'INCAPACITATING INJURY') severity = 'severe-injury';
  else if (sevField === 'NONINCAPACITATING INJURY') severity = 'moderate-injury';

  return {
    id: `chi-${raw.crash_record_id}`,
    lat,
    lng,
    date: raw.crash_date?.split('T')[0] ?? '',
    modes,
    severity,
    fatalities,
    injuries,
    source: 'chi',
  };
}

async function fetchChicagoCrashes(
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

  const res = await fetch(`${CHI_ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`Chicago API ${res.status}`);

  const raw: ChicagoRawCrash[] = await res.json();
  return raw.map(normalizeCrash).filter((c): c is NormalizedCrash => c !== null);
}

export const chicagoSource: DataSourceConfig = {
  id: 'chi',
  name: 'Chicago Traffic Crashes',
  bounds: [41.6445, -87.9401, 42.0230, -87.5240], // [south, west, north, east]
  fetch: fetchChicagoCrashes,
  city: 'Chicago',
  citation: 'City of Chicago Data Portal, Chicago Police Department E-Crash',
  dateRange: '2015–present',
  url: 'https://data.cityofchicago.org/Transportation/Traffic-Crashes-Crashes/85ca-t3if',
};
