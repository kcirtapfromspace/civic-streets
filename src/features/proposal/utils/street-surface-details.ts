import type { ElementType, StreetSegment } from '@/lib/types';
import { computeElementOffsets, offsetPolyline } from './offset-polyline';

type LatLng = { lat: number; lng: number };
type Detail = 'joint' | 'marking' | 'dash';
const FEET_TO_METERS = 0.3048;
const MAX_JOINTS_PER_ELEMENT = 512;
const DRIVABLE: ReadonlySet<ElementType> = new Set([
  'travel-lane', 'turn-lane', 'parking-lane', 'bike-lane', 'bike-lane-protected', 'transit-lane',
]);
const JOINT_COLOR = '#8B887E';
const WHITE_MARKING = '#ECE7D7';
const GOLD_MARKING = '#D5B66B';

function distanceMeters(from: LatLng, to: LatLng): number {
  const radians = Math.PI / 180;
  const a = Math.min(1, Math.sin((to.lat - from.lat) * radians / 2) ** 2 +
    Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin((to.lng - from.lng) * radians / 2) ** 2);
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolate(from: LatLng, to: LatLng, fraction: number): LatLng {
  return { lat: from.lat + (to.lat - from.lat) * fraction, lng: from.lng + (to.lng - from.lng) * fraction };
}

function line(points: LatLng[], detail: Detail, color: string): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: points.map((point) => [point.lng, point.lat]) }, properties: { detail, color } };
}

/** Illustrative surface detail, not a surveyed paving or road-marking plan. */
export function buildStreetSurfaceDetails(roadPath: LatLng[], street: StreetSegment): GeoJSON.Feature<GeoJSON.LineString>[] {
  if (roadPath.length < 2 || !Number.isFinite(street.totalROWWidth) || street.totalROWWidth <= 0 ||
    roadPath.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) >= 90 || Math.abs(point.lng) > 180)) return [];
  const lengths = roadPath.slice(1).map((point, index) => distanceMeters(roadPath[index], point));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) return [];
  const widths = street.elements.map((element) => ({ width: Number.isFinite(element.width) && element.width > 0 ? element.width : 0 }));
  const offsets = computeElementOffsets(widths, street.totalROWWidth);
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  street.elements.forEach((element, index) => {
    const { centerOffset, width } = offsets[index];
    if (width === 0) return;
    if (element.type === 'sidewalk' || element.type === 'furniture-zone') {
      const nominalSpacing = (element.type === 'sidewalk' ? 6 : 3) * FEET_TO_METERS;
      const spacing = Math.max(nominalSpacing, totalLength / (MAX_JOINTS_PER_ELEMENT + 1));
      // Interpolate the polygon edges themselves. A fresh perpendicular at each
      // station can protrude outside the existing strip on curved segments.
      const inner = offsetPolyline(roadPath, centerOffset - width / 2);
      const outer = offsetPolyline(roadPath, centerOffset + width / 2);
      let nextStation = spacing;
      let travelled = 0;
      let count = 0;
      lengths.forEach((length, segment) => {
        const segmentEnd = travelled + length;
        while (length > 0 && nextStation < segmentEnd && count < MAX_JOINTS_PER_ELEMENT) {
          const fraction = (nextStation - travelled) / length;
          features.push(line([
            interpolate(inner[segment], inner[segment + 1], fraction),
            interpolate(outer[segment], outer[segment + 1], fraction),
          ], 'joint', JOINT_COLOR));
          nextStation += spacing;
          count += 1;
        }
        travelled = segmentEnd;
      });
    }

    const next = street.elements[index + 1];
    if (!next || widths[index + 1].width === 0 || !DRIVABLE.has(element.type) || !DRIVABLE.has(next.type)) return;
    const bothTravel = element.type === 'travel-lane' && next.type === 'travel-lane';
    const oppositeSides = (element.side === 'left' && next.side === 'right') || (element.side === 'right' && next.side === 'left');
    const gold = element.type === 'turn-lane' || next.type === 'turn-lane' || (bothTravel && street.direction === 'two-way' && oppositeSides);
    features.push(line(offsetPolyline(roadPath, centerOffset + width / 2), bothTravel && !gold ? 'dash' : 'marking', gold ? GOLD_MARKING : WHITE_MARKING));
  });
  return features;
}
