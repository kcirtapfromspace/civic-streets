import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crashCache, fetchCrashesForViewport, sourcesForBounds } from '../index';

const denver = { south: 39.73, west: -105, north: 39.75, east: -104.98 };
const sf = { south: 37.77, west: -122.43, north: 37.79, east: -122.41 };
const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, json: async () => data });

describe('crash source selection and outcomes', () => {
  beforeEach(() => {
    crashCache.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    [denver, ['denver']],
    [{ south: 39.84, west: -104.7, north: 39.87, east: -104.66 }, ['denver']], // Denver airport
    [{ south: 41.87, west: -87.64, north: 41.89, east: -87.62 }, ['chi']],
    [{ south: 40.7, west: -74.01, north: 40.72, east: -73.99 }, ['nyc']],
    [sf, ['fars']],
    [{ south: 51.5, west: -0.15, north: 51.6, east: -0.05 }, []],
  ])(
    'selects the municipal provider before national data, or explicitly limited fallback',
    (bounds, expected) => {
      expect(sourcesForBounds(bounds).map((source) => source.id)).toEqual(expected);
    },
  );

  it('preserves successful zero responses and avoids requesting/caching FARS in Denver', async () => {
    fetchMock.mockResolvedValue(ok({ features: [] }));
    const result = await fetchCrashesForViewport(denver);
    expect(result).toEqual({
      crashes: [],
      coverage: 'municipal',
      sources: [{ sourceId: 'denver', status: 'loaded', count: 0, warnings: [] }],
    });
    await fetchCrashesForViewport(denver);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('FeatureServer/325/query');
  });

  it('does not cache failures and lets the same view succeed on retry', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ok({ features: [] }));
    const failed = await fetchCrashesForViewport(denver);
    expect(failed.sources[0]).toMatchObject({
      sourceId: 'denver',
      status: 'error',
      error: expect.stringContaining('HTTP 503'),
    });
    const retried = await fetchCrashesForViewport(denver);
    expect(retried.sources[0].status).toBe('loaded');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('queries again when the date range changes', async () => {
    fetchMock.mockResolvedValue(ok({ features: [] }));
    await fetchCrashesForViewport(denver, { start: '2026-01-01', end: '2026-02-01' });
    await fetchCrashesForViewport(denver, { start: '2026-02-01', end: '2026-03-01' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports unconnected national coverage without sending undocumented coordinate queries', async () => {
    const result = await fetchCrashesForViewport(sf);
    expect(result.coverage).toBe('fatal-only');
    expect(result.sources[0]).toMatchObject({
      status: 'error',
      error: expect.stringContaining('not connected'),
    });
    expect(result.crashes).toEqual([]);
    await fetchCrashesForViewport(sf);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports unsupported geography explicitly without calling a source', async () => {
    await expect(
      fetchCrashesForViewport({ south: 51.5, west: -0.15, north: 51.6, east: -0.05 }),
    ).resolves.toEqual({
      crashes: [],
      sources: [],
      coverage: 'unsupported',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves Chicago and NYC data, labels their record limit, and does not infer severe injuries from counts', async () => {
    const row = {
      collision_id: 'nyc-1',
      crash_date: '2026-01-01T00:00:00',
      latitude: '40.71',
      longitude: '-74.00',
      number_of_persons_injured: '4',
    };
    fetchMock.mockResolvedValueOnce(
      ok(Array.from({ length: 1000 }, (_, id) => ({ ...row, collision_id: String(id) }))),
    );
    const nyc = await fetchCrashesForViewport({
      south: 40.7,
      west: -74.01,
      north: 40.72,
      east: -73.99,
    });
    expect(nyc.sources[0].status).toBe('partial');
    expect(nyc.sources[0].warnings[0]).toContain('1,000');
    expect(nyc.crashes[0]).toMatchObject({ source: 'nyc', injuries: 4, severity: 'unknown' });
    fetchMock.mockResolvedValueOnce(
      ok([
        {
          crash_record_id: 'chi-1',
          crash_date: '2026-01-01T00:00:00',
          latitude: '41.88',
          longitude: '-87.63',
          most_severe_injury: 'INCAPACITATING INJURY',
          injuries_total: '1',
        },
      ]),
    );
    const chicago = await fetchCrashesForViewport({
      south: 41.87,
      west: -87.64,
      north: 41.89,
      east: -87.62,
    });
    expect(chicago.crashes[0]).toMatchObject({ source: 'chi', severity: 'severe-injury' });
  });

  it('refreshes cached empty coverage after its freshness window expires', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    fetchMock.mockResolvedValue(ok({ features: [] }));
    await fetchCrashesForViewport(denver);
    await fetchCrashesForViewport(denver);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(now + 6 * 60_000);
    await fetchCrashesForViewport(denver);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds retained viewport history while keeping recent cached results reusable', async () => {
    fetchMock.mockResolvedValue(ok({ features: [] }));
    const views = Array.from({ length: 41 }, (_, index) => ({
      ...denver,
      west: denver.west + index * 0.0001,
    }));
    for (const view of views) await fetchCrashesForViewport(view);
    await fetchCrashesForViewport(views[40]);
    expect(fetchMock).toHaveBeenCalledTimes(41);
    await fetchCrashesForViewport(views[0]);
    expect(fetchMock).toHaveBeenCalledTimes(42);
  });

  it('retains a failed source alongside other cities that successfully returned data', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('cityofnewyork')) return { ok: false, status: 503 };
      if (url.includes('cityofchicago'))
        return ok([
          {
            crash_record_id: 'chi-1',
            crash_date: '2026-01-01',
            latitude: '41.88',
            longitude: '-87.63',
          },
        ]);
      return ok({ features: [] });
    });
    const result = await fetchCrashesForViewport({
      south: 39.6,
      west: -105.1,
      north: 42.1,
      east: -73.7,
    });
    expect(result.crashes.map((crash) => crash.id)).toEqual(['chi-chi-1']);
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: 'nyc', status: 'error' }),
        expect.objectContaining({ sourceId: 'chi', status: 'loaded', count: 1 }),
        expect.objectContaining({ sourceId: 'denver', status: 'loaded', count: 0 }),
      ]),
    );
    expect(result.sources).toHaveLength(3);
  });

  it('does not cache first-page records when a later Denver page fails', async () => {
    const row = {
      attributes: {
        object_id: 1,
        incident_id: 'one',
        geo_lat: 39.74,
        geo_lon: -104.99,
        first_occurrence_date: Date.parse('2026-01-01'),
      },
    };
    fetchMock
      .mockResolvedValueOnce(ok({ features: [row], exceededTransferLimit: true }))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ok({ features: [] }));
    const failed = await fetchCrashesForViewport(denver);
    expect(failed.sources[0].status).toBe('error');
    expect(failed.crashes).toEqual([]);
    const retry = await fetchCrashesForViewport(denver);
    expect(retry.sources[0].status).toBe('loaded');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('applies inclusive end dates to Chicago and NYC requests across a leap-day boundary', async () => {
    fetchMock.mockResolvedValue(ok([]));
    await fetchCrashesForViewport(
      { south: 41.87, west: -87.64, north: 41.89, east: -87.62 },
      { start: '2024-02-28', end: '2024-02-29' },
    );
    await fetchCrashesForViewport(
      { south: 40.7, west: -74.01, north: 40.72, east: -73.99 },
      { start: '2024-02-28', end: '2024-02-29' },
    );
    for (const [url] of fetchMock.mock.calls) {
      const filter = new URL(url).searchParams.get('$where');
      expect(filter).toContain("crash_date >= '2024-02-28T00:00:00'");
      expect(filter).toContain("crash_date < '2024-03-01T00:00:00'");
    }
  });

  it.each([
    [{ south: 41.87, west: -87.64, north: 41.89, east: -87.62 }, 'chi'],
    [{ south: 40.7, west: -74.01, north: 40.72, east: -73.99 }, 'nyc'],
  ])(
    'does not mislabel a malformed municipal payload as successful zero',
    async (bounds, sourceId) => {
      fetchMock.mockResolvedValue(ok({ error: 'Source unavailable' }));
      const result = await fetchCrashesForViewport(bounds);
      expect(result.sources[0]).toMatchObject({ sourceId, status: 'error' });
      expect(result.crashes).toEqual([]);
    },
  );
});
