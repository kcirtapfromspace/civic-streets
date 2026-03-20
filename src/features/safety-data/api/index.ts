import type { NormalizedCrash, DataSourceConfig } from '@/lib/types/safety-data';
import { nycSource } from './nyc-crashes';
import { farsSource } from './nhtsa-fars';
import { tileCache } from './cache';

const SOURCES: DataSourceConfig[] = [nycSource, farsSource];

function boundsIntersect(
  a: [number, number, number, number],
  b: { south: number; west: number; north: number; east: number },
): boolean {
  const [aSouth, aWest, aNorth, aEast] = a;
  return !(b.east < aWest || b.west > aEast || b.north < aSouth || b.south > aNorth);
}

/**
 * Fetch crash data for the current viewport.
 * Only calls sources whose bounding boxes intersect the viewport,
 * and only requests tiles that haven't been fetched yet.
 */
export async function fetchCrashesForViewport(
  bounds: { south: number; west: number; north: number; east: number },
): Promise<NormalizedCrash[]> {
  const matchingSources = SOURCES.filter((src) =>
    boundsIntersect(src.bounds, bounds),
  );

  if (matchingSources.length === 0) return [];

  const results = await Promise.allSettled(
    matchingSources.map(async (source) => {
      const unfetched = tileCache.getUnfetchedTiles(source.id, bounds);
      if (unfetched.length === 0) return [];

      // Merge unfetched tiles into one bounding box for the API call
      const merged = {
        south: Math.min(...unfetched.map((t) => t.south)),
        west: Math.min(...unfetched.map((t) => t.west)),
        north: Math.max(...unfetched.map((t) => t.north)),
        east: Math.max(...unfetched.map((t) => t.east)),
      };

      return source.fetch(merged);
    }),
  );

  const crashes: NormalizedCrash[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      crashes.push(...result.value);
    }
  }

  return crashes;
}

export { tileCache };
