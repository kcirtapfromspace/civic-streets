import type { CrashBounds, CrashDateRange, CrashFetchResult, CrashMode, DataSourceConfig, NormalizedCrash } from '@/lib/types/safety-data';
import { inBounds, nextDate, validateBounds, validateDateRange } from './validation';

// Official Denver Open Data layer; metadata verified 2026-09-14.
// Dates use the service's UTC reference. The service supports ordered pagination.
export const DENVER_CRASH_LAYER = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325';
const PAGE_SIZE = 2000;
const MAX_PAGES = 10;
const FIELDS = 'object_id,incident_id,first_occurrence_date,geo_lat,geo_lon,bicycle_ind,pedestrian_ind,SERIOUSLY_INJURED,FATALITIES';

interface DenverFeature {
  attributes: Record<string, unknown>;
  geometry?: { x?: number; y?: number };
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalize(feature: DenverFeature): NormalizedCrash | null {
  const raw = feature.attributes;
  const lat = typeof raw.geo_lat === 'number' ? raw.geo_lat : feature.geometry?.y;
  const lng = typeof raw.geo_lon === 'number' ? raw.geo_lon : feature.geometry?.x;
  const incidentId = typeof raw.incident_id === 'string' ? raw.incident_id.trim() : '';
  const id = incidentId || (typeof raw.object_id === 'number' ? `row-${raw.object_id}` : '');
  const timestamp = raw.first_occurrence_date;
  if (!id || typeof lat !== 'number' || typeof lng !== 'number'
    || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180
    || typeof timestamp !== 'number' || !Number.isFinite(timestamp)
    || !Number.isFinite(new Date(timestamp).getTime())) return null;

  const fatalities = count(raw.FATALITIES);
  const injuries = count(raw.SERIOUSLY_INJURED);
  const modes: CrashMode[] = ['motorist'];
  if (raw.pedestrian_ind === 1) modes.push('pedestrian');
  if (raw.bicycle_ind === 1) modes.push('cyclist');

  return {
    id: `denver-${id}`, lat, lng,
    date: new Date(timestamp).toISOString().slice(0, 10),
    modes,
    severity: fatalities !== null && fatalities > 0 ? 'fatal'
      : injuries !== null && injuries > 0 ? 'severe-injury' : 'unknown',
    fatalities, injuries, injuryCountScope: 'serious-only', source: 'denver',
  };
}

function mergeIncident(a: NormalizedCrash, b: NormalizedCrash): NormalizedCrash {
  const fatalities = a.fatalities === null ? b.fatalities : b.fatalities === null ? a.fatalities : Math.max(a.fatalities, b.fatalities);
  const injuries = a.injuries === null ? b.injuries : b.injuries === null ? a.injuries : Math.max(a.injuries, b.injuries);
  return {
    ...a, fatalities, injuries, modes: [...new Set([...a.modes, ...b.modes])],
    severity: fatalities !== null && fatalities > 0 ? 'fatal'
      : injuries !== null && injuries > 0 ? 'severe-injury' : 'unknown',
  };
}

export async function fetchDenverCrashes(bounds: CrashBounds, dateRange?: CrashDateRange | null): Promise<CrashFetchResult> {
  validateBounds(bounds);
  validateDateRange(dateRange);
  const now = new Date();
  const availableStart = `${now.getUTCFullYear() - 5}-01-01`;
  const availableEnd = now.toISOString().slice(0, 10);
  const start = dateRange && dateRange.start > availableStart ? dateRange.start : availableStart;
  const end = dateRange && dateRange.end < availableEnd ? dateRange.end : availableEnd;
  const warnings: string[] = [];
  if (dateRange && (dateRange.start < availableStart || dateRange.end > availableEnd)) {
    warnings.push(`Requested dates extend beyond this rolling dataset (${availableStart} through ${availableEnd}).`);
  }
  if (start > end) return { crashes: [], warnings };

  const params = new URLSearchParams({
    f: 'json',
    where: `first_occurrence_date >= TIMESTAMP '${start} 00:00:00' AND first_occurrence_date < TIMESTAMP '${nextDate(end)} 00:00:00'`,
    geometry: JSON.stringify({ xmin: bounds.west, ymin: bounds.south, xmax: bounds.east, ymax: bounds.north, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true',
    outFields: FIELDS, orderByFields: 'object_id ASC', resultRecordCount: String(PAGE_SIZE),
  });
  const incidents = new Map<string, NormalizedCrash>();
  const seenRows = new Set<number>();
  let offset = 0;
  let omitted = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    params.set('resultOffset', String(offset));
    const response = await fetch(`${DENVER_CRASH_LAYER}/query?${params}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Denver crash data request failed (HTTP ${response.status}).`);
    const data = await response.json();
    if (data?.error) throw new Error('Denver crash data service rejected the query.');
    if (!Array.isArray(data?.features)) throw new Error('Denver crash data returned an unexpected response.');
    if (data.features.length > PAGE_SIZE) throw new Error('Denver crash data exceeded the requested page size.');
    let newRows = 0;
    for (const feature of data.features as DenverFeature[]) {
      if (!feature?.attributes || typeof feature.attributes !== 'object') {
        throw new Error('Denver crash data returned an unexpected record.');
      }
      const objectId = feature.attributes.object_id;
      if (typeof objectId !== 'number' || !Number.isSafeInteger(objectId)) throw new Error('Denver crash data is missing its pagination identifier.');
      if (!seenRows.has(objectId)) { seenRows.add(objectId); newRows++; }
      const crash = normalize(feature);
      if (!crash || !inBounds(crash.lat, crash.lng, bounds) || crash.date < start || crash.date > end) {
        omitted++;
        continue;
      }
      const existing = incidents.get(crash.id);
      incidents.set(crash.id, existing ? mergeIncident(existing, crash) : crash);
    }
    const hasMore = data.exceededTransferLimit === true
      || (data.exceededTransferLimit === undefined && data.features.length === PAGE_SIZE);
    if (!hasMore) break;
    if (newRows === 0) throw new Error('Denver crash data pagination did not advance. Try again.');
    offset += data.features.length;
    if (page === MAX_PAGES - 1) {
      warnings.push(`Results reached the download limit (${MAX_PAGES} pages, up to ${PAGE_SIZE * MAX_PAGES} rows). Zoom in or shorten the date range.`);
    }
  }
  if (omitted) warnings.push(`${omitted} source rows could not be mapped within the requested location and dates.`);
  return { crashes: [...incidents.values()], warnings };
}

export const denverSource: DataSourceConfig = {
  id: 'denver', name: 'Denver Traffic Accidents',
  // Dataset selection only, including the airport; records belong to Denver city.
  bounds: [39.60, -105.12, 39.92, -104.60],
  fetch: fetchDenverCrashes, coverage: 'municipal', city: 'Denver',
  citation: 'City and County of Denver / Denver Police Department',
  dateRange: 'Previous five calendar years + current year to date',
  coverageNote: 'Denver city records, updated weekdays. Dates use the source’s UTC reference. Only serious injury counts are supplied; other injury severity is unknown. Bicycle and pedestrian flags identify involvement, not who was injured.',
  url: DENVER_CRASH_LAYER,
};
