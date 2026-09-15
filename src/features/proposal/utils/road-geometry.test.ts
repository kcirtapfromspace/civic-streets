import { describe, expect, it, vi } from 'vitest';
import { computeBearing, fetchRoadPath } from './road-geometry';
import { snapToRoad } from './road-snap';
import { computeElementOffsets, offsetPolyline } from './offset-polyline';

const location = { lat: 39.74, lng: -104.99 };
const trail = [location, { lat: 39.741, lng: -104.99 }];
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('road geometry and fallback contracts', () => {
  it('returns routed GeoJSON in latitude/longitude order and a normalized compass bearing', async () => {
    const fetch = vi.fn().mockResolvedValue(
      response({
        routes: [
          {
            geometry: {
              coordinates: [
                [-104.99, 39.74],
                [-104.99, 39.75],
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await fetchRoadPath(location)).toEqual({
      path: [location, { lat: 39.75, lng: -104.99 }],
      bearing: 0,
    });
    expect(String(fetch.mock.calls[0][0])).toContain('geometries=geojson');
    expect(computeBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBe(90);
    expect(computeBearing({ lat: 0, lng: 0 }, { lat: 0, lng: -1 })).toBe(270);
    expect(computeBearing({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBe(180);
  });

  it.each([
    { label: 'HTTP error', body: {}, status: 503 },
    { label: 'missing routes', body: {} },
    { label: 'empty routes', body: { routes: [] } },
    {
      label: 'one route point',
      body: { routes: [{ geometry: { coordinates: [[-104.99, 39.74]] } }] },
    },
    { label: 'malformed geometry', body: { routes: [{ geometry: null }] } },
  ])('falls back predictably for $label', async ({ body, status }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => response(body, status)),
    );
    const fallback = await fetchRoadPath(location);
    expect(fallback.path).toHaveLength(3);
    expect(fallback.path[1]).toEqual(location);
    expect(fallback.bearing).toBe(0);
    expect(await snapToRoad(trail)).toBe(trail);
  });

  it('uses endpoints for short drags and includes the midpoint for long drags', async () => {
    const fetch = vi.fn().mockImplementation(async () =>
      response({
        routes: [
          {
            geometry: {
              coordinates: [
                [0, 0],
                [1, 1],
                [2, 1],
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await snapToRoad([])).toEqual([]);
    expect(await snapToRoad([location])).toEqual([location]);
    expect(fetch).not.toHaveBeenCalled();
    expect(await snapToRoad(trail)).toEqual([
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 2 },
    ]);
    expect(String(fetch.mock.calls[0][0])).toContain('-104.99,39.74;-104.99,39.741');
    const long = Array.from({ length: 101 }, (_, index) => ({ lat: index / 1000, lng: 1 }));
    await snapToRoad(long);
    expect(String(fetch.mock.calls[1][0])).toContain('1,0;1,0.05;1,0.1');
  });

  it('retains the original user geometry when the routing network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    expect(await snapToRoad(trail)).toBe(trail);
    expect((await fetchRoadPath(location)).path[1]).toEqual(location);
  });

  it('offsets both ends and corners without mutating the centerline', () => {
    const north = [
      { lat: 0, lng: 0 },
      { lat: 0.001, lng: 0 },
      { lat: 0.002, lng: 0.001 },
    ];
    const original = structuredClone(north);
    const right = offsetPolyline(north, 10);
    const left = offsetPolyline(north, -10);
    expect(right).toHaveLength(3);
    expect(right[0].lng).toBeGreaterThan(0);
    expect(left[0].lng).toBeLessThan(0);
    expect(right.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
    expect(offsetPolyline(north, 0)).toEqual(north);
    expect(north).toEqual(original);
    expect(offsetPolyline([location], 10)).toEqual([location]);
    expect(offsetPolyline([], 10)).toEqual([]);
    expect(computeElementOffsets([{ width: 4 }, { width: 10 }, { width: 6 }], 20)).toEqual([
      { centerOffset: -8, width: 4 },
      { centerOffset: -1, width: 10 },
      { centerOffset: 7, width: 6 },
    ]);
    expect(computeElementOffsets([], 0)).toEqual([]);
  });
});
