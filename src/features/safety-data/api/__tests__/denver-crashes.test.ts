import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DENVER_CRASH_LAYER, fetchDenverCrashes } from '../denver-crashes';

const bounds = { south: 39.73, west: -105, north: 39.75, east: -104.98 };
const range = { start: '2026-01-01', end: '2026-09-14' };
const fetchMock = vi.fn();
const feature = (objectId: number, values: Record<string, unknown> = {}) => ({
  attributes: {
    object_id: objectId,
    incident_id: `incident-${objectId}`,
    geo_lat: 39.7392,
    geo_lon: -104.9903,
    first_occurrence_date: Date.parse('2026-09-10T00:30:00Z'),
    FATALITIES: 0,
    SERIOUSLY_INJURED: 0,
    bicycle_ind: 0,
    pedestrian_ind: 0,
    ...values,
  },
});
const response = (data: unknown) => ({ ok: true, json: async () => data });

describe('Denver official crash adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('normalizes UTC dates and confirmed fatalities/serious injuries without inventing minor severity', async () => {
    fetchMock.mockResolvedValue(
      response({
        features: [
          feature(1, { FATALITIES: 2, SERIOUSLY_INJURED: 3, bicycle_ind: 1, pedestrian_ind: 1 }),
          feature(2, { SERIOUSLY_INJURED: 1 }),
          feature(3, { FATALITIES: null, SERIOUSLY_INJURED: null }),
          feature(4),
        ],
      }),
    );
    const result = await fetchDenverCrashes(bounds, range);
    expect(result.crashes[0]).toMatchObject({
      id: 'denver-incident-1',
      date: '2026-09-10',
      severity: 'fatal',
      fatalities: 2,
      injuries: 3,
      injuryCountScope: 'serious-only',
      modes: ['motorist', 'pedestrian', 'cyclist'],
      source: 'denver',
    });
    expect(result.crashes[1].severity).toBe('severe-injury');
    expect(result.crashes[2]).toMatchObject({
      severity: 'unknown',
      fatalities: null,
      injuries: null,
    });
    expect(result.crashes[3].severity).toBe('unknown');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(`${DENVER_CRASH_LAYER}/query`);
    expect(url.searchParams.get('where')).toBe(
      "first_occurrence_date >= TIMESTAMP '2026-01-01 00:00:00' AND first_occurrence_date < TIMESTAMP '2026-09-15 00:00:00'",
    );
    expect(JSON.parse(url.searchParams.get('geometry')!)).toMatchObject({
      xmin: -105,
      ymin: 39.73,
      xmax: -104.98,
      ymax: 39.75,
    });
    expect(url.searchParams.get('inSR')).toBe('4326');
    expect(url.searchParams.get('outSR')).toBe('4326');
    expect(url.searchParams.get('resultRecordCount')).toBe('2000');
  });

  it('follows transfer-limit pagination and merges repeated incident IDs without summing casualties', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          features: [feature(1), feature(2, { incident_id: 'shared', SERIOUSLY_INJURED: 2 })],
          exceededTransferLimit: true,
        }),
      )
      .mockResolvedValueOnce(
        response({
          features: [
            feature(3, {
              incident_id: 'shared',
              FATALITIES: 1,
              SERIOUSLY_INJURED: 2,
              bicycle_ind: 1,
            }),
          ],
          exceededTransferLimit: false,
        }),
      );
    const result = await fetchDenverCrashes(bounds, range);
    expect(result.crashes).toHaveLength(2);
    expect(result.crashes.find((crash) => crash.id === 'denver-shared')).toMatchObject({
      fatalities: 1,
      injuries: 2,
      severity: 'fatal',
      modes: ['motorist', 'cyclist'],
    });
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('resultOffset')).toBe('2');
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('orderByFields')).toBe(
      'object_id ASC',
    );
  });

  it('returns successful zero results distinctly from an invalid service response', async () => {
    fetchMock.mockResolvedValueOnce(response({ features: [], exceededTransferLimit: false }));
    await expect(fetchDenverCrashes(bounds, range)).resolves.toEqual({ crashes: [], warnings: [] });
    fetchMock.mockResolvedValueOnce(response({}));
    await expect(fetchDenverCrashes(bounds, range)).rejects.toThrow('unexpected response');
  });

  it.each([
    [{ ok: false, status: 503 }, 'HTTP 503'],
    [response({ error: { code: 400 } }), 'rejected the query'],
    [response({ features: [], exceededTransferLimit: true }), 'pagination did not advance'],
  ])('surfaces source failure rather than returning zero', async (res, message) => {
    fetchMock.mockResolvedValue(res);
    await expect(fetchDenverCrashes(bounds, range)).rejects.toThrow(message);
  });

  it('detects a repeated page and refuses to certify a partial download', async () => {
    fetchMock.mockResolvedValue(response({ features: [feature(1)], exceededTransferLimit: true }));
    await expect(fetchDenverCrashes(bounds, range)).rejects.toThrow('pagination did not advance');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds download work and explicitly reports incomplete results', async () => {
    fetchMock.mockImplementation(async () =>
      response({ features: [feature(fetchMock.mock.calls.length)], exceededTransferLimit: true }),
    );
    const result = await fetchDenverCrashes(bounds, range);
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(result.warnings?.join(' ')).toMatch(/download limit.*10 pages/);
  });

  it('reports excluded invalid records and uses WGS84 geometry when attribute coordinates are missing', async () => {
    fetchMock.mockResolvedValue(
      response({
        features: [
          feature(1, { first_occurrence_date: null }),
          {
            ...feature(2, { geo_lat: null, geo_lon: null }),
            geometry: { x: -104.9903, y: 39.7392 },
          },
        ],
      }),
    );
    const result = await fetchDenverCrashes(bounds, range);
    expect(result.crashes).toHaveLength(1);
    expect(result.warnings?.[0]).toContain('1 source rows could not be mapped');
  });

  it('clamps dates to the rolling available years and marks out-of-coverage dates as incomplete', async () => {
    fetchMock.mockResolvedValue(response({ features: [] }));
    const result = await fetchDenverCrashes(bounds, { start: '2010-01-01', end: '2010-12-31' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.warnings?.[0]).toContain('2021-01-01 through 2026-09-14');
  });

  it('rejects invalid dates and coordinates before requesting the source', async () => {
    await expect(
      fetchDenverCrashes(bounds, { start: "2026-01-01' OR 1=1", end: '2026-09-14' }),
    ).rejects.toThrow('valid start');
    await expect(fetchDenverCrashes({ ...bounds, west: NaN }, range)).rejects.toThrow(
      'valid coordinates',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not return an apparently complete first page when a later page fails', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ features: [feature(1)], exceededTransferLimit: true }))
      .mockRejectedValueOnce(new TypeError('Network connection lost'));
    await expect(fetchDenverCrashes(bounds, range)).rejects.toThrow('Network connection lost');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('includes the full final UTC day while excluding wrong-location and out-of-range source records', async () => {
    fetchMock.mockResolvedValue(
      response({
        features: [
          feature(1, { first_occurrence_date: Date.parse('2026-09-14T23:59:59Z') }),
          feature(2, { first_occurrence_date: Date.parse('2026-09-15T00:00:00Z') }),
          feature(3, { first_occurrence_date: Date.parse('2025-12-31T23:59:59Z') }),
          feature(4, { geo_lat: 39.9 }),
        ],
      }),
    );
    const result = await fetchDenverCrashes(bounds, range);
    expect(result.crashes.map((crash) => crash.id)).toEqual(['denver-incident-1']);
    expect(result.warnings?.join(' ')).toContain('3 source rows could not be mapped');
  });

  it('preserves known casualty counts when duplicate incident records have missing values', async () => {
    fetchMock.mockResolvedValue(
      response({
        features: [
          feature(1, { incident_id: 'shared', FATALITIES: null, SERIOUSLY_INJURED: 2 }),
          feature(2, { incident_id: 'shared', FATALITIES: 1, SERIOUSLY_INJURED: null }),
          feature(3, { incident_id: 'shared', FATALITIES: null, SERIOUSLY_INJURED: 2 }),
        ],
      }),
    );
    const result = await fetchDenverCrashes(bounds, range);
    expect(result.crashes).toHaveLength(1);
    expect(result.crashes[0]).toMatchObject({ fatalities: 1, injuries: 2, severity: 'fatal' });
  });

  it('retains mappable records with no incident identifier using a stable row identifier', async () => {
    fetchMock.mockResolvedValue(response({ features: [feature(42, { incident_id: null })] }));
    const result = await fetchDenverCrashes(bounds, range);
    expect(result.crashes[0].id).toBe('denver-row-42');
  });

  it.each([
    [{ features: [null] }, 'unexpected record'],
    [{ features: [{ attributes: {} }] }, 'pagination identifier'],
    [{ features: [feature(1, { object_id: 1.5 })] }, 'pagination identifier'],
    [{ features: Array.from({ length: 2001 }, (_, id) => feature(id)) }, 'page size'],
  ])('rejects malformed or oversized pages before certifying coverage', async (data, message) => {
    fetchMock.mockResolvedValue(response(data));
    await expect(fetchDenverCrashes(bounds, range)).rejects.toThrow(message);
  });

  it('checks the next page when a full response omits the transfer-limit flag', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({ features: Array.from({ length: 2000 }, (_, id) => feature(id)) }),
      )
      .mockResolvedValueOnce(response({ features: [feature(2000)] }));
    const result = await fetchDenverCrashes(bounds, range);
    expect(result.crashes).toHaveLength(2001);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('resultOffset')).toBe('2000');
    expect(result.warnings).toEqual([]);
  });

  it.each([
    { start: '2026-02-30', end: '2026-03-01' },
    { start: '2026-03-02', end: '2026-03-01' },
  ])('rejects impossible calendar dates and reversed periods', async (dates) => {
    await expect(fetchDenverCrashes(bounds, dates)).rejects.toThrow('valid start and end date');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
