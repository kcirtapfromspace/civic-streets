import type { ElementType } from '@/lib/types';

export type MaterialName = 'asphalt' | 'concrete' | 'pavers' | 'planted' | 'cycle' | 'transit';

/** Muted surface colors are also usable before a map's pattern images have loaded. */
export const MAP_MATERIALS: Record<MaterialName, { color: string; edge: string }> = {
  asphalt: { color: '#45494a', edge: '#34393a' },
  concrete: { color: '#d4d0c4', edge: '#a19f93' },
  pavers: { color: '#b9aa97', edge: '#968977' },
  planted: { color: '#718656', edge: '#50683e' },
  cycle: { color: '#4d8270', edge: '#355f51' },
  transit: { color: '#a76559', edge: '#824a41' },
};

export const MATERIAL_FOR_ELEMENT: Record<ElementType, MaterialName> = {
  sidewalk: 'concrete',
  'planting-strip': 'planted',
  'furniture-zone': 'pavers',
  'bike-lane': 'cycle',
  'bike-lane-protected': 'cycle',
  buffer: 'concrete',
  'parking-lane': 'asphalt',
  'travel-lane': 'asphalt',
  'turn-lane': 'asphalt',
  'transit-lane': 'transit',
  median: 'planted',
  curb: 'concrete',
};

const TILE_SIZE = 64;
const SURFACE: Record<
  MaterialName,
  { seed: number; broad: number; detail: number; grain: number }
> = {
  asphalt: { seed: 11, broad: 2, detail: 2.5, grain: 7 },
  concrete: { seed: 23, broad: 3.5, detail: 2, grain: 4 },
  pavers: { seed: 37, broad: 7, detail: 3, grain: 3 },
  planted: { seed: 53, broad: 11, detail: 7, grain: 1.5 },
  cycle: { seed: 71, broad: 1.5, detail: 1.5, grain: 6 },
  transit: { seed: 89, broad: 1.5, detail: 1.5, grain: 6 },
};

/** Integer hashing keeps each surface stable without touching global random state. */
function noise(x: number, y: number, seed: number): number {
  let value = Math.imul(x ^ seed, 0x45d9f3b) ^ Math.imul(y ^ (seed << 1), 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  return (((value ^ (value >>> 13)) >>> 0) / 0xffffffff) * 2 - 1;
}

function smoothNoise(x: number, y: number, cells: number, seed: number): number {
  const gridX = x * cells;
  const gridY = y * cells;
  const left = Math.floor(gridX);
  const top = Math.floor(gridY);
  const fractionX = gridX - left;
  const fractionY = gridY - top;
  const blendX = fractionX * fractionX * (3 - 2 * fractionX);
  const blendY = fractionY * fractionY * (3 - 2 * fractionY);
  // Wrap the lattice itself, including negative domain-warp coordinates.
  const sample = (column: number, row: number) =>
    noise(((column % cells) + cells) % cells, ((row % cells) + cells) % cells, seed);
  const upper = sample(left, top) * (1 - blendX) + sample(left + 1, top) * blendX;
  const lower = sample(left, top + 1) * (1 - blendX) + sample(left + 1, top + 1) * blendX;
  return upper * (1 - blendY) + lower * blendY;
}

export function materialImageId(material: MaterialName): string {
  return `curbwise-material-v1-${material}`;
}

/**
 * Small, colored, opaque repeat tiles for MapLibre addImage/fill-pattern.
 * Broad and fine variation wrap in both axes; warped noise avoids a visible grid.
 * Paving joints and directional road markings belong in street geometry.
 */
export function createMaterialImage(material: MaterialName): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const { seed, broad, detail, grain } = SURFACE[material];
  const color = MAP_MATERIALS[material].color;
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const data = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const u = x / TILE_SIZE;
      const v = y / TILE_SIZE;
      const warpedU = u + smoothNoise(u, v, 4, seed + 101) * 0.045;
      const warpedV = v + smoothNoise(u, v, 4, seed + 211) * 0.045;
      const aggregate = (noise(x, y, seed + 307) + noise(x, y, seed + 419)) / 2;
      const variation =
        smoothNoise(warpedU, warpedV, 4, seed) * broad +
        smoothNoise(warpedU, warpedV, 8, seed + 13) * detail +
        aggregate * grain;
      const pixel = (y * TILE_SIZE + x) * 4;
      // These palettes and bounded amplitudes remain comfortably inside 0–255.
      for (let channel = 0; channel < 3; channel++) {
        data[pixel + channel] = Math.round(channels[channel] + variation);
      }
      data[pixel + 3] = 255;
    }
  }

  return { width: TILE_SIZE, height: TILE_SIZE, data };
}
