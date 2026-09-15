import type { CrashBounds, CrashDateRange, CrashSourceResult, CrashViewportResult, DataSourceConfig, NormalizedCrash } from '@/lib/types/safety-data';
import { nycSource } from './nyc-crashes';
import { chicagoSource } from './chicago-crashes';
import { denverSource } from './denver-crashes';
import { farsSource } from './nhtsa-fars';
import { crashCache } from './cache';
import { inBounds, validateBounds, validateDateRange } from './validation';

export const DATA_SOURCES: DataSourceConfig[] = [nycSource, chicagoSource, denverSource, farsSource];

export function sourcesForBounds(bounds: CrashBounds): DataSourceConfig[] {
  const matching = DATA_SOURCES.filter(({ bounds: [south, west, north, east] }) =>
    !(bounds.east <= west || bounds.west >= east || bounds.north <= south || bounds.south >= north));
  const municipal = matching.filter((source) => source.coverage === 'municipal');
  // Avoid counting municipal crashes again through FARS. Municipal datasets only
  // cover their own cities, even when the view extends into neighboring places.
  return municipal.length ? municipal : matching;
}

export async function fetchCrashesForViewport(bounds: CrashBounds, dateRange?: CrashDateRange | null): Promise<CrashViewportResult> {
  validateBounds(bounds);
  validateDateRange(dateRange);
  const sources = sourcesForBounds(bounds);
  const outcomes = await Promise.all(sources.map(async (source) => {
    const [south, west, north, east] = source.bounds;
    const clipped = {
      south: Math.max(bounds.south, south), west: Math.max(bounds.west, west),
      north: Math.min(bounds.north, north), east: Math.min(bounds.east, east),
    };
    const key = JSON.stringify([source.id, clipped, dateRange ?? null]);
    try {
      let result = crashCache.get(key);
      if (!result) {
        result = await source.fetch(clipped, dateRange);
        crashCache.set(key, result);
      }
      const crashes = result.crashes.filter((crash) => inBounds(crash.lat, crash.lng, bounds)
        && (!dateRange || (crash.date >= dateRange.start && crash.date <= dateRange.end)));
      const warnings = result.warnings ?? [];
      const status: CrashSourceResult = {
        sourceId: source.id, status: warnings.length ? 'partial' : 'loaded',
        count: crashes.length, warnings,
      };
      return { crashes, status };
    } catch (error) {
      const status: CrashSourceResult = {
        sourceId: source.id, status: 'error', count: 0, warnings: [],
        error: error instanceof Error ? error.message : 'The source could not be reached.',
      };
      return { crashes: [], status };
    }
  }));
  const unique = new Map<string, NormalizedCrash>();
  outcomes.forEach(({ crashes }) => crashes.forEach((crash) => unique.set(crash.id, crash)));
  return {
    crashes: [...unique.values()], sources: outcomes.map(({ status }) => status),
    coverage: sources.length === 0 ? 'unsupported'
      : sources.some((source) => source.coverage === 'municipal') ? 'municipal' : 'fatal-only',
  };
}

export { crashCache };
