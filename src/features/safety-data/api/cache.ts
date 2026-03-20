/**
 * Tile-key in-memory cache for crash data.
 * Divides the world into ~0.01° grid tiles and tracks which are fetched.
 */

const TILE_SIZE = 0.01; // ~1.1km

interface TileKey {
  tileX: number;
  tileY: number;
}

function toTileKey(lat: number, lng: number): TileKey {
  return {
    tileX: Math.floor(lng / TILE_SIZE),
    tileY: Math.floor(lat / TILE_SIZE),
  };
}

function tileKeyStr(key: TileKey): string {
  return `${key.tileX}:${key.tileY}`;
}

export interface TileCache {
  /** Check if a tile has already been fetched for a given source */
  isFetched: (source: string, lat: number, lng: number) => boolean;
  /** Mark a tile as fetched */
  markFetched: (source: string, lat: number, lng: number) => void;
  /** Get all unfetched tile bounds for a viewport */
  getUnfetchedTiles: (
    source: string,
    bounds: { south: number; west: number; north: number; east: number },
  ) => Array<{ south: number; west: number; north: number; east: number }>;
  /** Clear cache for a source or all */
  clear: (source?: string) => void;
}

const fetchedTiles = new Map<string, Set<string>>();

function getSourceSet(source: string): Set<string> {
  let set = fetchedTiles.get(source);
  if (!set) {
    set = new Set();
    fetchedTiles.set(source, set);
  }
  return set;
}

export const tileCache: TileCache = {
  isFetched(source, lat, lng) {
    const key = tileKeyStr(toTileKey(lat, lng));
    return getSourceSet(source).has(key);
  },

  markFetched(source, lat, lng) {
    const key = tileKeyStr(toTileKey(lat, lng));
    getSourceSet(source).add(key);
  },

  getUnfetchedTiles(source, bounds) {
    const set = getSourceSet(source);
    const tiles: Array<{ south: number; west: number; north: number; east: number }> = [];

    const startX = Math.floor(bounds.west / TILE_SIZE);
    const endX = Math.floor(bounds.east / TILE_SIZE);
    const startY = Math.floor(bounds.south / TILE_SIZE);
    const endY = Math.floor(bounds.north / TILE_SIZE);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = tileKeyStr({ tileX: x, tileY: y });
        if (!set.has(key)) {
          set.add(key);
          tiles.push({
            south: y * TILE_SIZE,
            west: x * TILE_SIZE,
            north: (y + 1) * TILE_SIZE,
            east: (x + 1) * TILE_SIZE,
          });
        }
      }
    }

    return tiles;
  },

  clear(source) {
    if (source) {
      fetchedTiles.delete(source);
    } else {
      fetchedTiles.clear();
    }
  },
};
