import type { CrashHistory } from '../../../shared/crash-history';
export type CrashMode = 'pedestrian' | 'cyclist' | 'motorist';
export type CrashSeverity = 'fatal' | 'severe-injury' | 'moderate-injury' | 'minor' | 'unknown';

export interface CrashBounds { south: number; west: number; north: number; east: number }
export interface CrashDateRange { start: string; end: string }
export interface CrashFetchResult {
  crashes: NormalizedCrash[];
  history?: CrashHistory;
  /** Incomplete results, unavailable fields, or source query limits. */
  warnings?: string[];
}
export interface CrashSourceResult {
  sourceId: string;
  history?: CrashHistory;
  status: 'loaded' | 'partial' | 'error';
  count: number;
  warnings: string[];
  error?: string;
}
export type CrashCoverage = 'municipal' | 'fatal-only' | 'unsupported';
export interface CrashViewportResult {
  crashes: NormalizedCrash[];
  sources: CrashSourceResult[];
  coverage: CrashCoverage;
}

export interface NormalizedCrash {
  id: string;
  lat: number;
  lng: number;
  date: string; // ISO date
  modes: CrashMode[];
  severity: CrashSeverity;
  fatalities: number | null;
  injuries: number | null;
  injuryCountScope?: 'all' | 'serious-only';
  source: string;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  /** Bounding box: [south, west, north, east] */
  bounds: [number, number, number, number];
  fetch: (bounds: CrashBounds, dateRange?: CrashDateRange | null) => Promise<CrashFetchResult>;
  coverage: 'municipal' | 'fatal-only';
  coverageNote: string;
  /** City or region name for display */
  city: string;
  /** Reporting agency / publisher */
  citation: string;
  /** Date range of available data */
  dateRange: string;
  /** URL to the source data portal */
  url: string;
}

export interface CrashFilters {
  modes: Set<CrashMode>;
  severities: Set<CrashSeverity>;
  dateRange: CrashDateRange | null;
}

export const SEVERITY_WEIGHTS: Record<CrashSeverity, number> = {
  'fatal': 1.0,
  'severe-injury': 0.7,
  'moderate-injury': 0.4,
  'minor': 0.15,
  'unknown': 0.15,
};

export const SEVERITY_COLORS: Record<CrashSeverity, string> = {
  'fatal': '#DC2626',
  'severe-injury': '#EA580C',
  'moderate-injury': '#F59E0B',
  'minor': '#6B7280',
  'unknown': '#64748B',
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
  'unknown': 'Other / unknown severity',
};
