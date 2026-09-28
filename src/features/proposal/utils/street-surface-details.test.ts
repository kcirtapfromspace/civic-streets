import { describe, expect, it } from 'vitest';
import { buildStreetSurfaceDetails } from './street-surface-details';
import { computeElementOffsets, offsetPolyline } from './offset-polyline';
import { DEFAULT_CONSTRAINTS } from '@/lib/constants';
import type { CrossSectionElement, ElementType, StreetSegment } from '@/lib/types';

const R = 6_371_000;
const feetToLatitude = (feet: number) => feet * 0.3048 / R * 180 / Math.PI;
const north = (feet: number) => [{ lat: 0, lng: 0 }, { lat: feetToLatitude(feet), lng: 0 }];
function element(type: ElementType, width = 6, side: CrossSectionElement['side'] = 'left'): CrossSectionElement {
  return { id: `${type}-${side}`, type, width, side, locked: false, constraints: DEFAULT_CONSTRAINTS[type] };
}
function street(elements: CrossSectionElement[], direction: StreetSegment['direction'] = 'two-way'): StreetSegment {
  return { id: 'street', name: 'Illustrative street', elements, totalROWWidth: elements.reduce((sum, item) => sum + (Number.isFinite(item.width) && item.width > 0 ? item.width : 0), 0), curbToCurbWidth: 0, direction, functionalClass: 'local', metadata: { createdAt: '2026-09-28', updatedAt: '2026-09-28' } };
}
const jointFeatures = (path: Array<{ lat: number; lng: number }>, fixture: StreetSegment) => buildStreetSurfaceDetails(path, fixture).filter((feature) => feature.properties?.detail === 'joint');
const coordinates = (feature: GeoJSON.Feature<GeoJSON.LineString>) => feature.geometry.coordinates as [number, number][];

function assertPointOnEdge(point: number[], from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const deltaLat = to.lat - from.lat;
  const deltaLng = to.lng - from.lng;
  const t = Math.abs(deltaLat) > Math.abs(deltaLng) ? (point[1] - from.lat) / deltaLat : (point[0] - from.lng) / deltaLng;
  expect(t).toBeGreaterThanOrEqual(-1e-8);
  expect(t).toBeLessThanOrEqual(1 + 1e-8);
  expect(point[0]).toBeCloseTo(from.lng + deltaLng * t, 12);
  expect(point[1]).toBeCloseTo(from.lat + deltaLat * t, 12);
}

describe('illustrative street surface details', () => {
  it('draws transverse sidewalk joints every six real feet in longitude/latitude order', () => {
    const path = north(25);
    const fixture = street([element('sidewalk')]);
    const original = structuredClone({ path, fixture });
    const joints = jointFeatures(path, fixture);
    expect(joints).toHaveLength(4);
    joints.forEach((joint, index) => {
      const [left, right] = coordinates(joint);
      expect(left[1]).toBeCloseTo(feetToLatitude(6 * (index + 1)), 12);
      expect(right[1]).toBeCloseTo(left[1], 12);
      expect(left[0]).toBeLessThan(right[0]);
      expect(right[0] - left[0]).toBeCloseTo(feetToLatitude(6), 12);
      expect(joint.properties).toEqual({ detail: 'joint', color: '#8B887E' });
    });
    expect({ path, fixture }).toEqual(original);
  });

  it('orients paving joints across an eastbound furniture strip every three feet at a non-equatorial latitude', () => {
    const start = { lat: 40, lng: -105 };
    const end = { lat: 40, lng: start.lng + feetToLatitude(10) / Math.cos(40 * Math.PI / 180) };
    const joints = jointFeatures([start, end], street([element('furniture-zone', 4)]));
    expect(joints).toHaveLength(3);
    joints.forEach((joint, index) => {
      const [left, right] = coordinates(joint);
      expect(left[1]).toBeGreaterThan(right[1]);
      expect(left[0]).toBeCloseTo(start.lng + feetToLatitude(3 * (index + 1)) / Math.cos(40 * Math.PI / 180), 10);
      expect(right[0]).toBeCloseTo(left[0], 10);
    });
  });

  it('carries joint spacing through bends and interpolates the same strip edges instead of rotating outside them', () => {
    const bend = { lat: feetToLatitude(8), lng: 0 };
    const end = { lat: bend.lat, lng: feetToLatitude(12) };
    const path = [{ lat: 0, lng: 0 }, bend, end];
    const fixture = street([element('planting-strip', 2), element('sidewalk', 6)]);
    const joints = jointFeatures(path, fixture);
    expect(joints).toHaveLength(3);
    const offset = computeElementOffsets(fixture.elements, fixture.totalROWWidth)[1];
    const inner = offsetPolyline(path, offset.centerOffset - 3);
    const outer = offsetPolyline(path, offset.centerOffset + 3);
    joints.forEach((joint, index) => {
      const segment = index === 0 ? 0 : 1;
      assertPointOnEdge(coordinates(joint)[0], inner[segment], inner[segment + 1]);
      assertPointOnEdge(coordinates(joint)[1], outer[segment], outer[segment + 1]);
    });
    // The second station is 12 ft along the whole path: 4 ft into the
    // second segment, not another 6 ft after the bend.
    const second = coordinates(joints[1])[0];
    expect(second[0]).toBeCloseTo(inner[1].lng + (inner[2].lng - inner[1].lng) / 3, 11);
  });

  it('skips duplicate segments while keeping original offset-edge geometry and station continuity', () => {
    const path = [...north(7), north(7)[1], { lat: feetToLatitude(19), lng: 0 }];
    const joints = jointFeatures(path, street([element('sidewalk')]));
    expect(joints).toHaveLength(3);
    expect(joints.map((joint) => coordinates(joint)[0][1])).toEqual([6, 12, 18].map(feetToLatitude));
    expect(buildStreetSurfaceDetails([path[0], path[0], path[0]], street([element('sidewalk')]))).toEqual([]);
  });

  it('continues from a station exactly on a vertex without dividing by a zero-length segment', () => {
    const path = [north(6)[0], north(6)[1], north(6)[1], north(13)[1]];
    const joints = jointFeatures(path, street([element('sidewalk')]));
    expect(joints).toHaveLength(2);
    expect(joints.flatMap(coordinates).flat().every(Number.isFinite)).toBe(true);
    expect(coordinates(joints[0])[0][1]).toBeCloseTo(feetToLatitude(6), 12);
  });

  it('bounds long paths to 512 joints per pavement element with evenly increased spacing', () => {
    const fixture = street([element('sidewalk'), element('furniture-zone', 4)]);
    const features = jointFeatures(north(10_000), fixture);
    expect(features).toHaveLength(1024);
    for (const group of [features.slice(0, 512), features.slice(512)]) {
      const latitudes = group.map((feature) => coordinates(feature)[0][1]);
      const spacing = feetToLatitude(10_000 / 513);
      expect(latitudes[0]).toBeCloseTo(spacing, 12);
      latitudes.slice(1).forEach((latitude, i) => expect(latitude - latitudes[i]).toBeCloseTo(spacing, 12));
      expect(latitudes[511]).toBeLessThan(feetToLatitude(10_000));
    }
  });

  it.each([
    { direction: 'two-way', sides: ['left', 'right'], detail: 'marking', color: '#D5B66B' },
    { direction: 'two-way', sides: ['right', 'left'], detail: 'marking', color: '#D5B66B' },
    { direction: 'two-way', sides: ['left', 'left'], detail: 'dash', color: '#ECE7D7' },
    { direction: 'two-way', sides: ['center', 'right'], detail: 'dash', color: '#ECE7D7' },
    { direction: 'one-way', sides: ['left', 'right'], detail: 'dash', color: '#ECE7D7' },
  ] as const)('distinguishes travel-lane separation from street direction and sides: $direction $sides', ({ direction, sides, detail, color }) => {
    const fixture = street([element('travel-lane', 10, sides[0]), element('travel-lane', 10, sides[1])], direction);
    const path = [...north(20), { lat: feetToLatitude(35), lng: feetToLatitude(5) }];
    const features = buildStreetSurfaceDetails(path, fixture);
    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({ detail, color });
    expect(coordinates(features[0])).toEqual(path.map((point) => [point.lng, point.lat]));
  });

  it('uses gold beside turn lanes and warm white for other adjacent drivable elements', () => {
    const fixture = street([
      element('parking-lane', 8), element('turn-lane', 10), element('travel-lane', 10),
      element('bike-lane', 5), element('bike-lane-protected', 6), element('transit-lane', 10),
    ]);
    const features = buildStreetSurfaceDetails(north(15), fixture);
    expect(features.map((feature) => feature.properties)).toEqual([
      { detail: 'marking', color: '#D5B66B' }, { detail: 'marking', color: '#D5B66B' },
      { detail: 'marking', color: '#ECE7D7' }, { detail: 'marking', color: '#ECE7D7' }, { detail: 'marking', color: '#ECE7D7' },
    ]);
    const offsets = computeElementOffsets(fixture.elements, fixture.totalROWWidth);
    features.forEach((feature, index) => expect(coordinates(feature)).toEqual(offsetPolyline(north(15), offsets[index].centerOffset + offsets[index].width / 2).map((point) => [point.lng, point.lat])));
  });

  it('does not invent markings through dividers or along non-drivable edges', () => {
    const fixture = street([
      element('travel-lane'), element('buffer'), element('bike-lane'), element('curb'),
      element('travel-lane'), element('median'), element('parking-lane'), element('planting-strip'),
    ]);
    expect(buildStreetSurfaceDetails(north(20), fixture)).toEqual([]);
    expect(jointFeatures(north(2), street([element('sidewalk'), element('furniture-zone')]))).toEqual([]);
  });

  it('skips invalid or nonpositive widths without poisoning valid pavement or bridging invalid separators', () => {
    const invalidWidths = [0, -1, NaN, Infinity];
    const fixture = street([
      element('travel-lane', 10), ...invalidWidths.map((width) => element('sidewalk', width)),
      element('travel-lane', 10), element('sidewalk', 6),
    ]);
    const features = buildStreetSurfaceDetails(north(14), fixture);
    expect(features).toHaveLength(2);
    expect(features.every((feature) => feature.properties?.detail === 'joint')).toBe(true);
    expect(features.flatMap(coordinates).flat().every(Number.isFinite)).toBe(true);
    expect(coordinates(features[0])[0][0]).toBeCloseTo(feetToLatitude(7), 12);
  });

  it.each([
    [], [{ lat: 0, lng: 0 }], [{ lat: NaN, lng: 0 }, { lat: 1, lng: 0 }],
    [{ lat: 0, lng: Infinity }, { lat: 1, lng: 0 }], [{ lat: 90, lng: 0 }, { lat: 89, lng: 0 }],
    [{ lat: 0, lng: 181 }, { lat: 1, lng: 0 }],
  ].map((path) => ({ path })))('returns no detail for unusable paths $path', ({ path }) => {
    expect(buildStreetSurfaceDetails(path, street([element('sidewalk')]))).toEqual([]);
  });
  it.each([0, -1, NaN, Infinity])('rejects unusable declared widths %s', (totalROWWidth) => {
    expect(buildStreetSurfaceDetails(north(20), { ...street([element('sidewalk')]), totalROWWidth })).toEqual([]);
  });
});
