import type { HotspotPin } from '@/lib/types/community';

/**
 * Ray casting algorithm for point-in-polygon test.
 * Returns true if the point [lng, lat] is inside the polygon.
 */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Filter hotspot pins to only those inside a polygon.
 * Polygon coordinates are [lng, lat] pairs.
 */
export function filterByPolygon(
  hotspots: HotspotPin[],
  polygon: [number, number][],
): HotspotPin[] {
  return hotspots.filter((h) => pointInPolygon([h.lng, h.lat], polygon));
}
