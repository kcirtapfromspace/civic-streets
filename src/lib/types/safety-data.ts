export type CrashMode = 'pedestrian' | 'cyclist' | 'motorist';
export type CrashSeverity = 'fatal' | 'severe-injury' | 'moderate-injury' | 'minor';

export interface NormalizedCrash {
  id: string;
  lat: number;
  lng: number;
  date: string; // ISO date
  modes: CrashMode[];
  severity: CrashSeverity;
  fatalities: number;
  injuries: number;
  source: string;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  /** Bounding box: [south, west, north, east] */
  bounds: [number, number, number, number];
  fetch: (bounds: { south: number; west: number; north: number; east: number }) => Promise<NormalizedCrash[]>;
}

export interface CrashFilters {
  modes: Set<CrashMode>;
  severities: Set<CrashSeverity>;
  dateRange: { start: string; end: string } | null;
}

export const SEVERITY_WEIGHTS: Record<CrashSeverity, number> = {
  'fatal': 1.0,
  'severe-injury': 0.7,
  'moderate-injury': 0.4,
  'minor': 0.15,
};

export const SEVERITY_COLORS: Record<CrashSeverity, string> = {
  'fatal': '#DC2626',
  'severe-injury': '#EA580C',
  'moderate-injury': '#F59E0B',
  'minor': '#6B7280',
};

export const MODE_LABELS: Record<CrashMode, string> = {
  'pedestrian': 'Pedestrian',
  'cyclist': 'Cyclist',
  'motorist': 'Motorist',
};

export const SEVERITY_LABELS: Record<CrashSeverity, string> = {
  'fatal': 'Fatal',
  'severe-injury': 'Severe Injury',
  'moderate-injury': 'Moderate Injury',
  'minor': 'Minor',
};
