import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chicagoSource } from '../chicago-crashes';
import { nycSource } from '../nyc-crashes';

const chicagoBounds = { south: 41.87, west: -87.64, north: 41.89, east: -87.62 };
const nycBounds = { south: 40.7, west: -74.01, north: 40.72, east: -73.99 };
const chicagoRow = {
  crash_record_id: 'chicago-one',
  crash_date: '2026-02-28T23:59:00',
  latitude: '41.88',
  longitude: '-87.63',
};
const nycRow = {
  collision_id: 'nyc-one',
  crash_date: '2026-02-28T00:00:00',
  crash_time: '23:59',
  latitude: '40.71',
  longitude: '-74.00',
};
const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, json: async () => data });

describe('municipal crash source contracts', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('preserves Chicago injury classifications and pedestrian, cyclist, and motorist involvement', async () => {
    fetchMock.mockResolvedValue(
      ok([
        {
          ...chicagoRow,
          crash_record_id: 'pedestrian-fatal',
          first_crash_type: 'PEDESTRIAN',
          most_severe_injury: 'FATAL',
          injuries_fatal: '1',
          injuries_total: '2',
        },
        {
          ...chicagoRow,
          crash_record_id: 'cyclist-serious',
          first_crash_type: 'PEDALCYCLIST',
          most_severe_injury: 'INCAPACITATING INJURY',
          injuries_fatal: '0',
          injuries_total: '1',
        },
        {
          ...chicagoRow,
          crash_record_id: 'motorist-injury',
          first_crash_type: 'REAR END',
          most_severe_injury: 'NONINCAPACITATING INJURY',
          injuries_fatal: '0',
          injuries_total: '1',
        },
      ]),
    );
    const result = await chicagoSource.fetch(chicagoBounds);
    expect(result.crashes).toEqual([
      {
        id: 'chi-pedestrian-fatal',
        lat: 41.88,
        lng: -87.63,
        date: '2026-02-28',
        modes: ['pedestrian'],
        severity: 'fatal',
        fatalities: 1,
        injuries: 2,
        source: 'chi',
      },
      {
        id: 'chi-cyclist-serious',
        lat: 41.88,
        lng: -87.63,
        date: '2026-02-28',
        modes: ['cyclist'],
        severity: 'severe-injury',
        fatalities: 0,
        injuries: 1,
        source: 'chi',
      },
      {
        id: 'chi-motorist-injury',
        lat: 41.88,
        lng: -87.63,
        date: '2026-02-28',
        modes: ['motorist'],
        severity: 'moderate-injury',
        fatalities: 0,
        injuries: 1,
        source: 'chi',
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('retains all NYC modes with reported fatalities while keeping counts numeric and dates local to the source', async () => {
    fetchMock.mockResolvedValue(
      ok([
        {
          ...nycRow,
          number_of_persons_killed: '3',
          number_of_persons_injured: '0',
          number_of_pedestrians_killed: '1',
          number_of_cyclist_killed: '1',
          number_of_motorist_killed: '1',
        },
      ]),
    );
    const result = await nycSource.fetch(nycBounds);
    expect(result.crashes).toEqual([
      {
        id: 'nyc-nyc-one',
        lat: 40.71,
        lng: -74,
        date: '2026-02-28',
        modes: ['pedestrian', 'cyclist', 'motorist'],
        severity: 'fatal',
        fatalities: 3,
        injuries: 0,
        source: 'nyc',
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('retains NYC injury involvement without converting the number injured into injury severity', async () => {
    fetchMock.mockResolvedValue(
      ok([
        {
          ...nycRow,
          number_of_persons_killed: '0',
          number_of_persons_injured: '5',
          number_of_pedestrians_injured: '1',
          number_of_cyclist_injured: '1',
          number_of_motorist_injured: '3',
        },
      ]),
    );
    const result = await nycSource.fetch(nycBounds);
    expect(result.crashes[0]).toMatchObject({
      modes: ['pedestrian', 'cyclist', 'motorist'],
      severity: 'unknown',
      fatalities: 0,
      injuries: 5,
    });
  });

  it.each([
    [chicagoSource, chicagoBounds, chicagoRow],
    [nycSource, nycBounds, nycRow],
  ])(
    'omits unusable %s coordinates with an explicit incompleteness warning',
    async (source, bounds, row) => {
      fetchMock.mockResolvedValue(
        ok([
          row,
          { ...row, latitude: undefined },
          { ...row, longitude: undefined },
          { ...row, latitude: 'not-a-coordinate' },
          { ...row, longitude: '' },
          { ...row, latitude: '0' },
          { ...row, longitude: '0' },
        ]),
      );
      const result = await source.fetch(bounds);
      expect(result.crashes).toHaveLength(1);
      expect(result.crashes[0]).toMatchObject({
        lat: Number(row.latitude),
        lng: Number(row.longitude),
      });
      expect(result.warnings).toEqual(['6 records had no usable map coordinates.']);
    },
  );

  it('labels a full Chicago response as potentially incomplete even when every row maps successfully', async () => {
    fetchMock.mockResolvedValue(
      ok(
        Array.from({ length: 1000 }, (_, index) => ({
          ...chicagoRow,
          crash_record_id: String(index),
        })),
      ),
    );
    const result = await chicagoSource.fetch(chicagoBounds);
    expect(result.crashes).toHaveLength(1000);
    expect(result.warnings).toEqual([expect.stringContaining('at most 1,000 records per view')]);
  });

  it.each([
    [chicagoSource, chicagoBounds, 'Chicago API 429'],
    [nycSource, nycBounds, 'NYC API 429'],
  ])(
    'rejects a rate-limited %s response rather than inventing an empty dataset',
    async (source, bounds, message) => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 });
      await expect(source.fetch(bounds)).rejects.toThrow(message);
    },
  );
});
