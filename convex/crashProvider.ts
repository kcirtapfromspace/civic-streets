import type { Infer } from 'convex/values';
import { crash } from './crashValidators';
import { monthRange, type CrashCity } from '../shared/crash-history';

export const PAGE_SIZE = 200;
const DENVER = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325/query';
export type ArchiveCrash = Infer<typeof crash>;
const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const count = (value: unknown) => {
  const n = number(value);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
};
function normalize(source: CrashCity, raw: Record<string, unknown>): ArchiveCrash | null {
  const denver = source === 'denver', nyc = source === 'nyc';
  const lat = number(denver ? raw.geo_lat : raw.latitude);
  const lng = number(denver ? raw.geo_lon : raw.longitude);
  const rawId = denver ? raw.incident_id : nyc ? raw.collision_id : raw.crash_record_id;
  const timestamp = denver ? number(raw.first_occurrence_date) : Date.parse(String(raw.crash_date));
  if (lat === null || lng === null || lat === 0 || lng === 0 || Math.abs(lat) > 90 || Math.abs(lng) > 180
    || rawId === undefined || rawId === null || !String(rawId).trim() || String(rawId).length > 200
    || timestamp === null || !Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) return null;
  const fatalities = count(denver ? raw.FATALITIES : nyc ? raw.number_of_persons_killed : raw.injuries_fatal);
  const injuries = count(denver ? raw.SERIOUSLY_INJURED : nyc ? raw.number_of_persons_injured : raw.injuries_total);
  const modes: ArchiveCrash['modes'] = [];
  if (denver ? raw.pedestrian_ind === 1 : nyc
    ? (count(raw.number_of_pedestrians_killed) ?? 0) + (count(raw.number_of_pedestrians_injured) ?? 0) > 0
    : raw.first_crash_type === 'PEDESTRIAN') modes.push('pedestrian');
  if (denver ? raw.bicycle_ind === 1 : nyc
    ? (count(raw.number_of_cyclist_killed) ?? 0) + (count(raw.number_of_cyclist_injured) ?? 0) > 0
    : raw.first_crash_type === 'PEDALCYCLIST') modes.push('cyclist');
  if (denver || modes.length === 0 || (nyc && (count(raw.number_of_motorist_killed) ?? 0) + (count(raw.number_of_motorist_injured) ?? 0) > 0)) modes.push('motorist');
  let severity: ArchiveCrash['severity'] = 'unknown';
  if ((fatalities ?? 0) > 0) severity = 'fatal';
  else if (denver && (injuries ?? 0) > 0) severity = 'severe-injury';
  else if (source === 'chi') {
    if (raw.most_severe_injury === 'INCAPACITATING INJURY') severity = 'severe-injury';
    else if (raw.most_severe_injury === 'NONINCAPACITATING INJURY') severity = 'moderate-injury';
    else if (['NO INDICATION OF INJURY', 'REPORTED, NOT EVIDENT'].includes(String(raw.most_severe_injury))) severity = 'minor';
  }
  return { id: `${source}-${rawId}`, source, lat, lng, date: new Date(timestamp).toISOString().slice(0, 10),
    fatalities, injuries, modes, severity, injuryCountScope: denver ? 'serious-only' : 'all' };
}

export async function fetchArchivePage(source: CrashCity, month: string, offset: number) {
  const { start, next } = monthRange(month);
  const denver = source === 'denver';
  const endpoint = denver ? DENVER : source === 'chi'
    ? 'https://data.cityofchicago.org/resource/85ca-t3if.json'
    : 'https://data.cityofnewyork.us/resource/h9gi-nx95.json';
  const fields = source === 'chi'
    ? 'crash_record_id,crash_date,latitude,longitude,injuries_fatal,injuries_total,most_severe_injury,first_crash_type'
    : 'collision_id,crash_date,latitude,longitude,number_of_persons_killed,number_of_persons_injured,number_of_pedestrians_killed,number_of_pedestrians_injured,number_of_cyclist_killed,number_of_cyclist_injured,number_of_motorist_killed,number_of_motorist_injured';
  const params = new URLSearchParams(denver ? {
    f: 'json', where: `first_occurrence_date >= TIMESTAMP '${start} 00:00:00' AND first_occurrence_date < TIMESTAMP '${next} 00:00:00'`,
    outFields: 'object_id,incident_id,first_occurrence_date,geo_lat,geo_lon,bicycle_ind,pedestrian_ind,SERIOUSLY_INJURED,FATALITIES',
    returnGeometry: 'false', orderByFields: 'object_id ASC', resultRecordCount: String(PAGE_SIZE), resultOffset: String(offset),
  } : {
    $where: `crash_date >= '${start}T00:00:00' AND crash_date < '${next}T00:00:00'`,
    $select: fields, $order: source === 'chi' ? 'crash_record_id ASC' : 'collision_id ASC',
    $limit: String(PAGE_SIZE), $offset: String(offset),
  });
  const response = await fetch(`${endpoint}?${params}`, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!response.ok) throw new Error(`Publisher returned HTTP ${response.status}`);
  // Selected fields and bounded pages keep imports within action/transaction limits.
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Publisher response exceeded size limit');
  const data = JSON.parse(text);
  if (data?.error) throw new Error('Publisher rejected the archive query');
  const rows: unknown[] = denver ? data?.features : data;
  if (!Array.isArray(rows) || rows.length > PAGE_SIZE) throw new Error('Malformed publisher page');
  const records: ArchiveCrash[] = [];
  for (const row of rows) {
    const raw = denver ? (row as { attributes?: unknown })?.attributes : row;
    if (!raw || typeof raw !== 'object') throw new Error('Malformed publisher record');
    const record = normalize(source, raw as Record<string, unknown>);
    if (record && record.date >= start && record.date < next) records.push(record);
  }
  const more = denver && typeof data.exceededTransferLimit === 'boolean' ? data.exceededTransferLimit : rows.length === PAGE_SIZE;
  if (more && rows.length === 0) throw new Error('Publisher pagination did not advance');
  return { records, skipped: rows.length - records.length, more, nextOffset: offset + rows.length };
}
