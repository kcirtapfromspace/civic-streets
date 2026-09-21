// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { GEOCODING_QUERY_MIN_LENGTH, GEOCODING_QUERY_MAX_LENGTH } from '../shared/geocoding';

const modules = import.meta.glob(['./**/*.{js,ts}', '!./**/*.test.ts', '!./**/*.d.ts']);
const place = {
  place_id: 123,
  display_name: 'Broadway, Denver, Colorado',
  lat: '39.7392',
  lon: '-104.9903',
  address: { road: 'Broadway' },
  private_upstream_field: 'never return this',
};
const fetchMock = vi.fn();
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

async function setup() {
  const t = convexTest(schema, modules);
  const first = await t.mutation(api.users.createAnonymousUser, {});
  const second = await t.mutation(api.users.createAnonymousUser, {});
  return { t, first: first.sessionToken, second: second.sessionToken };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  vi.stubEnv('GEOCODING_BASE_URL', 'https://nominatim.openstreetmap.org');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async () => response([place]));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('shared geocoding proxy', () => {
  it.each([
    [' 80211 ', '80211', 'Denver', '39.77', '-105.02'],
    ['60601', '60601', 'Chicago', '41.88', '-87.62'],
    ['10001', '10001', 'New York City', '40.75', '-73.99'],
    ['02108', '02108', 'Boston', '42.36', '-71.06'],
    ['90210', '90210', 'Beverly Hills', '34.09', '-118.41'],
    ['99501', '99501', 'Anchorage', '61.21', '-149.88'],
    ['96813', '96813', 'Honolulu', '21.31', '-157.85'],
    ['00901', '00901', 'San Juan', '18.46', '-66.11'],
    ['80211-1234', '80211', 'Denver', '39.77', '-105.02'],
  ])('searches US ZIP %s independently of reporting coverage', async (query, zip, city, lat, lon) => {
    const { t, first, second } = await setup();
    fetchMock.mockResolvedValueOnce(response([{ ...place, display_name: city, lat, lon }]));
    const results = await t.action(api.geocoding.search, { sessionToken: first, query });
    expect(results).toMatchObject([{ display_name: city, lat, lon }]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('postalcode')).toBe(zip);
    expect(url.searchParams.get('countrycodes')).toBe('us,pr,vi,gu,as,mp');
    expect(url.searchParams.has('q')).toBe(false);
    expect(url.searchParams.has('viewbox')).toBe(false);
    expect(await t.action(api.geocoding.search, { sessionToken: second, query: zip })).toEqual(results);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not reuse one ZIP code result for a different ZIP', async () => {
    const { t, first } = await setup();
    await t.action(api.geocoding.search, { sessionToken: first, query: '80211' });
    vi.advanceTimersByTime(1101);
    fetchMock.mockResolvedValueOnce(response([{ ...place, display_name: 'Boston' }]));
    expect(await t.action(api.geocoding.search, { sessionToken: first, query: '02108' }))
      .toMatchObject([{ display_name: 'Boston' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses a fixed provider route, application identity, no redirects, and sanitized results', async () => {
    const { t, first } = await setup();
    const results = await t.action(api.geocoding.search, {
      sessionToken: first,
      query: 'Broadway Denver',
    });
    const [rawUrl, init] = fetchMock.mock.calls[0];
    const url = new URL(rawUrl);
    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('Broadway Denver');
    expect(init.headers['User-Agent']).toContain('Curbwise');
    expect(init.redirect).toBe('error');
    expect(JSON.stringify(init)).not.toContain(first);
    expect(results).toEqual([
      {
        place_id: 123,
        display_name: place.display_name,
        lat: place.lat,
        lon: place.lon,
        road: 'Broadway',
      },
    ]);
  });

  it('returns canonical coordinates so browser parsing matches server validation', async () => {
    const { t, first } = await setup();
    fetchMock.mockImplementation(async () =>
      response([{ ...place, lat: '0x27', lon: '-1.0499e2' }]),
    );
    const [result] = await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    expect(result).toMatchObject({ lat: '39', lon: '-104.99' });
    expect(parseFloat(result.lat)).toBe(39);
    expect(parseFloat(result.lon)).toBe(-104.99);
  });

  it('normalizes equivalent searches and serves the shared cache across sessions', async () => {
    const { t, first, second } = await setup();
    const initial = await t.action(api.geocoding.search, {
      sessionToken: first,
      query: 'Broadway Denver',
    });
    expect(
      await t.action(api.geocoding.search, {
        sessionToken: second,
        query: '  broadway   denver  ',
      }),
    ).toEqual(initial);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never accepts a query as an upstream URL', async () => {
    const { t, first } = await setup();
    await t.action(api.geocoding.search, {
      sessionToken: first,
      query: 'https://127.0.0.1/private',
    });
    expect(new URL(fetchMock.mock.calls[0][0]).origin).toBe('https://nominatim.openstreetmap.org');
  });

  it('requires a valid session before cache or upstream access', async () => {
    const { t, first } = await setup();
    await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    await expect(
      t.action(api.geocoding.search, { sessionToken: 'unknown', query: 'Denver' }),
    ).rejects.toThrow('Invalid session');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'ab', 'a'.repeat(201), 'Denver\nColorado'])(
    'rejects invalid search text before calling upstream',
    async (query) => {
      const { t, first } = await setup();
      await expect(
        t.action(api.geocoding.search, { sessionToken: first, query }),
      ).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [NaN, 0],
    [Infinity, 0],
    [91, 0],
    [0, -181],
    [0, Infinity],
  ])('rejects invalid reverse coordinates (%s,%s)', async (lat, lng) => {
    const { t, first } = await setup();
    await expect(
      t.action(api.geocoding.reverse, { sessionToken: first, lat, lng }),
    ).rejects.toThrow('valid map location');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares a reverse cache by rounded coordinates and preserves road names', async () => {
    const { t, first, second } = await setup();
    fetchMock.mockImplementation(async () => response(place));
    const initial = await t.action(api.geocoding.reverse, {
      sessionToken: first,
      lat: 39.7392001,
      lng: -104.9903001,
    });
    expect(initial[0].road).toBe('Broadway');
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/reverse');
    expect(
      await t.action(api.geocoding.reverse, {
        sessionToken: second,
        lat: 39.7392002,
        lng: -104.9903002,
      }),
    ).toEqual(initial);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('holds the global lease during fetch and waits 1100ms after completion across users', async () => {
    const { t, first, second } = await setup();
    let release!: (response: Response) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    fetchMock.mockImplementationOnce(() => {
      markStarted();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    const pending = t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    await started;
    vi.setSystemTime(Date.now() + 5_000);
    await expect(
      t.action(api.geocoding.search, { sessionToken: second, query: 'Chicago' }),
    ).rejects.toThrow('busy');
    release(response([place]));
    await pending;
    vi.setSystemTime(Date.now() + 1_099);
    await expect(
      t.action(api.geocoding.search, { sessionToken: second, query: 'Chicago' }),
    ).rejects.toThrow('busy');
    vi.setSystemTime(Date.now() + 1);
    await expect(
      t.action(api.geocoding.search, { sessionToken: second, query: 'Chicago' }),
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limits each session even for cache hits', async () => {
    const { t, first } = await setup();
    for (let i = 0; i < 10; i++)
      await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).rejects.toThrow('search limit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 60_000);
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).resolves.toHaveLength(1);
  });

  it('expires successful cache records', async () => {
    const { t, first } = await setup();
    await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    vi.setSystemTime(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1);
    await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['upstream 503', () => response({ error: 'unavailable' }, 503)],
    ['missing response body', () => new Response(null)],
    ['invalid object', () => response({ error: 'provider failure' })],
    ['invalid coordinates', () => response([{ ...place, lat: 'not-a-coordinate' }])],
    ['malformed JSON', () => new Response('not-json')],
    ['oversized response', () => new Response('a'.repeat(128 * 1024 + 1))],
  ])('never caches %s as an empty successful result', async (_name, failResponse) => {
    const { t, first } = await setup();
    fetchMock.mockImplementationOnce(async () => failResponse());
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).rejects.toThrow('unavailable');
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(1))).toEqual([]);
    vi.setSystemTime(Date.now() + 1_100);
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can cache a genuine successful empty search', async () => {
    const { t, first } = await setup();
    fetchMock.mockImplementation(async () => response([]));
    expect(
      await t.action(api.geocoding.search, { sessionToken: first, query: 'Unmatched place' }),
    ).toEqual([]);
    expect(
      await t.action(api.geocoding.search, { sessionToken: first, query: 'Unmatched place' }),
    ).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a slow upstream and releases the lease without caching the failure', async () => {
    const { t, first } = await setup();
    let started!: () => void;
    const hasStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    fetchMock.mockImplementationOnce((_url, init) => {
      started();
      return new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const pending = expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).rejects.toThrow('unavailable');
    await hasStarted;
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(1))).toEqual([]);
    vi.setSystemTime(Date.now() + 1_100);
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).resolves.toHaveLength(1);
  });

  it('does not let a stale action release a newer lease or poison the cache', async () => {
    const { t, first, second } = await setup();
    const old = await t.mutation(internal.geocoding.reserve, { sessionToken: first, key: 'old' });
    if (old.kind !== 'lease') throw new Error('Expected lease');
    vi.setSystemTime(Date.now() + 31_100);
    const current = await t.mutation(internal.geocoding.reserve, {
      sessionToken: second,
      key: 'current',
    });
    if (current.kind !== 'lease') throw new Error('Expected lease');
    await t.mutation(internal.geocoding.finish, { leaseId: old.leaseId, key: 'old', results: [] });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('geocodingLimits')
          .withIndex('by_key', (q) => q.eq('key', 'global'))
          .unique(),
      ),
    ).toMatchObject({ leaseId: current.leaseId });
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(1))).toEqual([]);
  });

  it.each([
    undefined,
    'http://nominatim.openstreetmap.org',
    'https://127.0.0.1',
    'https://localhost',
    'https://geocoder.internal',
    'https://user:password@provider.example.com',
    'https://provider.example.com?key=secret',
    'https://provider.example.com/anything',
    'not a URL',
    'https://provider.example.com:444',
    'https://provider.example.com/#route',
  ])('requires an explicitly configured safe provider base', async (base) => {
    const { t, first } = await setup();
    vi.stubEnv('GEOCODING_BASE_URL', base);
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('switches compatible providers by configuration without returning an old provider cache', async () => {
    const { t, first } = await setup();
    await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    vi.setSystemTime(Date.now() + 1_100);
    vi.stubEnv('GEOCODING_BASE_URL', 'https://geocoder.example.com/nominatim');
    await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    expect(new URL(fetchMock.mock.calls[1][0]).href).toContain(
      'https://geocoder.example.com/nominatim/search?',
    );
  });

  it.each([GEOCODING_QUERY_MIN_LENGTH, GEOCODING_QUERY_MAX_LENGTH])(
    'accepts the documented query length boundary of %s characters',
    async (length) => {
      const { t, first } = await setup();
      const query = 'x'.repeat(length);
      await expect(
        t.action(api.geocoding.search, { sessionToken: first, query }),
      ).resolves.toHaveLength(1);
      expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('q')).toBe(query);
    },
  );

  it.each([
    ['null row', null],
    ['fractional place ID', { ...place, place_id: 1.5 }],
    ['negative place ID', { ...place, place_id: -1 }],
    ['empty display name', { ...place, display_name: '   ' }],
    ['oversized display name', { ...place, display_name: 'x'.repeat(1_001) }],
    ['blank longitude', { ...place, lon: ' ' }],
  ])('rejects a provider %s without caching a partial result', async (_label, invalid) => {
    const { t, first } = await setup();
    fetchMock.mockImplementationOnce(async () => response([place, invalid]));
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).rejects.toThrow('unavailable');
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(1))).toEqual([]);
    const global = await t.run((ctx) =>
      ctx.db
        .query('geocodingLimits')
        .withIndex('by_key', (q) => q.eq('key', 'global'))
        .unique(),
    );
    expect(global?.leaseId).toBeUndefined();
    expect(global?.nextAllowedAt).toBeGreaterThan(Date.now());
  });

  it('caps provider results and omits invalid optional road metadata', async () => {
    const { t, first } = await setup();
    const records = [
      { ...place, address: null },
      { ...place, address: { road: 123 } },
      { ...place, address: { road: 'x'.repeat(201) } },
      { ...place, address: { road: '' } },
      place,
      null, // A provider returning extra rows cannot expand the five-result contract.
    ];
    fetchMock.mockImplementationOnce(async () => response(records));
    const results = await t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' });
    expect(results).toHaveLength(5);
    for (const result of results.slice(0, 4)) expect(result).not.toHaveProperty('road');
    expect(results[4].road).toBe('Broadway');
    expect(results.every((result) => !('private_upstream_field' in result))).toBe(true);
  });

  it('preserves Unicode when the provider splits a UTF-8 character between body chunks', async () => {
    const { t, first } = await setup();
    const displayName = 'Café street';
    const bytes = new TextEncoder().encode(
      JSON.stringify([{ ...place, display_name: displayName }]),
    );
    const split = bytes.indexOf(0xc3) + 1;
    expect(split).toBeGreaterThan(0);
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes.slice(0, split));
              controller.enqueue(bytes.slice(split));
              controller.close();
            },
          }),
        ),
    );
    const [result] = await t.action(api.geocoding.search, {
      sessionToken: first,
      query: 'Cafe Denver',
    });
    expect(result.display_name).toBe(displayName);
  });

  it('refreshes an empty result after its shorter one-hour cache lifetime', async () => {
    const { t, first } = await setup();
    fetchMock.mockImplementationOnce(async () => response([]));
    await t.action(api.geocoding.search, { sessionToken: first, query: 'New Denver street' });
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 - 1);
    expect(
      await t.action(api.geocoding.search, { sessionToken: first, query: 'New Denver street' }),
    ).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 1);
    expect(
      await t.action(api.geocoding.search, { sessionToken: first, query: 'New Denver street' }),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(2))).toHaveLength(1);
  });

  it('counts busy retries toward the session allowance without issuing provider requests', async () => {
    const { t, first, second } = await setup();
    const reserved = await t.mutation(internal.geocoding.reserve, {
      sessionToken: first,
      key: 'held-request',
    });
    expect(reserved.kind).toBe('lease');
    for (let i = 0; i < 10; i++) {
      await expect(
        t.action(api.geocoding.search, { sessionToken: second, query: 'Denver' }),
      ).rejects.toThrow('busy');
    }
    await expect(
      t.action(api.geocoding.search, { sessionToken: second, query: 'Denver' }),
    ).rejects.toThrow('search limit');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not start an upstream request after a long pause while acquiring the lease', async () => {
    const { t, first } = await setup();
    const randomUUID = crypto.randomUUID.bind(crypto);
    // Simulate wall-clock delay across the internal reservation boundary. The
    // request must not start unless its timeout fits inside the remaining lease.
    vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => {
      vi.setSystemTime(Date.now() + 20_000);
      return randomUUID();
    });
    await expect(
      t.action(api.geocoding.search, { sessionToken: first, query: 'Denver' }),
    ).rejects.toThrow('unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(1))).toEqual([]);
  });

  it('cleans expired cache and inactive sessions in bounded batches while preserving live state', async () => {
    const { t } = await setup();
    const now = Date.now();
    const { activeCache, activeSession, globalId } = await t.run(async (ctx) => {
      const globalId = await ctx.db.insert('geocodingLimits', {
        key: 'global',
        nextAllowedAt: now + 30_000,
        leaseId: 'live-lease',
        leaseExpiresAt: now + 30_000,
        windowStartedAt: now - 3 * 24 * 60 * 60 * 1000,
        requestCount: 1,
      });
      for (let i = 0; i < 101; i++) {
        await ctx.db.insert('geocodingCache', {
          key: `expired:${i}`,
          results: [],
          expiresAt: now - 1,
        });
        await ctx.db.insert('geocodingLimits', {
          key: `session:expired:${i}`,
          nextAllowedAt: 0,
          windowStartedAt: now - 2 * 24 * 60 * 60 * 1000,
          requestCount: 1,
        });
      }
      const activeCache = await ctx.db.insert('geocodingCache', {
        key: 'active',
        results: [],
        expiresAt: now + 1,
      });
      const activeSession = await ctx.db.insert('geocodingLimits', {
        key: 'session:active',
        nextAllowedAt: 0,
        windowStartedAt: now,
        requestCount: 1,
      });
      return { activeCache, activeSession, globalId };
    });
    await t.mutation(internal.geocoding.cleanup, {});
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(200))).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query('geocodingLimits').take(200))).toHaveLength(4);
    await t.mutation(internal.geocoding.cleanup, {});
    expect(await t.run((ctx) => ctx.db.query('geocodingCache').take(200))).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query('geocodingLimits').take(200))).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.get(activeCache))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(activeSession))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(globalId))).toMatchObject({ leaseId: 'live-lease' });
  });
});
