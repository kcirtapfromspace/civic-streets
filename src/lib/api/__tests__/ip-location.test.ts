import { afterEach, expect, it, vi } from 'vitest';
import { fetchApproximateLocation } from '../ip-location';

const valid = { latitude: '39.74', longitude: '-104.99', city: 'Denver', region: 'Colorado', accuracy: 20, ip: '192.0.2.1' };
const reply = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('uses a city estimate without retaining IP or sending cookies/referrer', async () => {
  reply(valid);
  expect(await fetchApproximateLocation()).toEqual({ center: { lat: 39.74, lng: -104.99 }, label: 'Denver, Colorado', zoom: 11 });
  expect(fetch).toHaveBeenCalledWith('https://get.geojs.io/v1/ip/geo.json', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: expect.any(AbortSignal) }));
});
it('uses a wider view for less accurate city estimates and tolerates missing region/accuracy', async () => {
  reply({ ...valid, region: null, accuracy: 100 });
  expect(await fetchApproximateLocation()).toMatchObject({ label: 'Denver', zoom: 9 });
  reply({ ...valid, accuracy: undefined });
  expect(await fetchApproximateLocation()).toMatchObject({ zoom: 11 });
});
it.each([
  null, [], 'unexpected', {},
  { ...valid, latitude: 39 }, { ...valid, latitude: '' },
  { ...valid, longitude: null }, { ...valid, longitude: ' ' },
  { ...valid, latitude: 'NaN' }, { ...valid, latitude: '86' },
  { ...valid, longitude: 'Infinity' }, { ...valid, longitude: '-181' },
  { ...valid, city: null }, { ...valid, city: '  ' }, { ...valid, accuracy: 101 }, { ...valid, accuracy: -1 }, { ...valid, accuracy: '10' },
])('rejects unusable or country-level provider data %#', async (body) => {
  reply(body);
  expect(await fetchApproximateLocation()).toBeNull();
});
it('falls back for HTTP errors, malformed JSON, and offline requests', async () => {
  reply({}, 429);
  expect(await fetchApproximateLocation()).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad-json')));
  expect(await fetchApproximateLocation()).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  expect(await fetchApproximateLocation()).toBeNull();
});
it('aborts an unavailable provider after four seconds', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal;
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  const result = fetchApproximateLocation();
  await vi.advanceTimersByTimeAsync(4000);
  expect(await result).toBeNull();
  expect(signal!.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
