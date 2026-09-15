import { ConvexError, v } from 'convex/values';
import { action, internalMutation, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { ensureUser } from './users';
import {
  GEOCODING_QUERY_MIN_LENGTH, GEOCODING_QUERY_MAX_LENGTH, type GeocodingResult,
} from '../shared/geocoding';

// See https://operations.osmfoundation.org/policies/nominatim/ before enabling
// the public service. All clients share a lease and a gap after completion.
const GLOBAL_KEY = 'global';
const GAP_MS = 1_100;
const FETCH_TIMEOUT_MS = 10_000;
const LEASE_MS = 30_000;
const SESSION_WINDOW_MS = 60_000;
const SESSION_REQUEST_LIMIT = 10;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const resultValidator = v.object({
  place_id: v.number(), display_name: v.string(), lat: v.string(), lon: v.string(),
  road: v.optional(v.string()),
});

function normalizeQuery(query: string): string {
  if (query.length > GEOCODING_QUERY_MAX_LENGTH || [...query].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new ConvexError('Enter a place or address using 3–200 characters.');
  }
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (normalized.length < GEOCODING_QUERY_MIN_LENGTH) {
    throw new ConvexError('Enter at least 3 characters to search for a place.');
  }
  return normalized;
}

function normalizeCoordinates(lat: number, lng: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ConvexError('Choose a valid map location.');
  }
  return { lat: lat.toFixed(5), lon: lng.toFixed(5) };
}

function configuredBaseUrl(): URL {
  const configured = process.env.GEOCODING_BASE_URL;
  if (!configured) {
    throw new ConvexError('Place search is not configured yet. You can choose a location on the map.');
  }
  let url: URL;
  try { url = new URL(configured); } catch {
    throw new ConvexError('Place search is unavailable. Please try again later.');
  }
  // Only an operator can set this base URL. Browser inputs supply no host,
  // route, headers or redirect target. Reject local/IP endpoints and URL tricks.
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '443') || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ||
      /(^|\.)(localhost|local|internal|lan)$/.test(host) ||
      !['/', '/nominatim', '/nominatim/'].includes(url.pathname)) {
    throw new ConvexError('Place search is unavailable. Please try again later.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

type Reservation =
  | { kind: 'cached'; results: GeocodingResult[] }
  | { kind: 'busy' }
  | { kind: 'limited' }
  | { kind: 'lease'; leaseId: string; leaseExpiresAt: number };

export const reserve = internalMutation({
  args: { sessionToken: v.string(), key: v.string() },
  handler: async (ctx, args): Promise<Reservation> => {
    const user = await ensureUser(ctx, args.sessionToken);
    const now = Date.now();
    const sessionKey = `session:${user._id}`;
    const session = await ctx.db.query('geocodingLimits')
      .withIndex('by_key', (q) => q.eq('key', sessionKey)).unique();
    const inWindow = session && now - session.windowStartedAt < SESSION_WINDOW_MS;
    const requestCount = inWindow ? session.requestCount : 0;
    if (requestCount >= SESSION_REQUEST_LIMIT) return { kind: 'limited' };
    // Count cache hits and busy responses too; never persist the bearer token.
    const sessionFields = {
      key: sessionKey, nextAllowedAt: 0,
      windowStartedAt: inWindow ? session.windowStartedAt : now,
      requestCount: requestCount + 1,
    };
    if (session) await ctx.db.patch(session._id, sessionFields);
    else await ctx.db.insert('geocodingLimits', sessionFields);

    const cached = await ctx.db.query('geocodingCache')
      .withIndex('by_key', (q) => q.eq('key', args.key)).unique();
    if (cached && cached.expiresAt > now) return { kind: 'cached', results: cached.results };

    const global = await ctx.db.query('geocodingLimits')
      .withIndex('by_key', (q) => q.eq('key', GLOBAL_KEY)).unique();
    if (global && (global.nextAllowedAt > now || (global.leaseExpiresAt ?? 0) > now)) {
      return { kind: 'busy' };
    }
    const leaseId = crypto.randomUUID();
    const leaseExpiresAt = now + LEASE_MS;
    const globalFields = {
      key: GLOBAL_KEY, leaseId, leaseExpiresAt,
      // A lost action holds the gate through its lease plus a full quiet gap.
      nextAllowedAt: leaseExpiresAt + GAP_MS, windowStartedAt: now, requestCount: 1,
    };
    if (global) await ctx.db.patch(global._id, globalFields);
    else await ctx.db.insert('geocodingLimits', globalFields);
    return { kind: 'lease', leaseId, leaseExpiresAt };
  },
});

export const finish = internalMutation({
  args: {
    leaseId: v.string(), key: v.string(),
    results: v.optional(v.array(resultValidator)),
  },
  handler: async (ctx, args) => {
    const global = await ctx.db.query('geocodingLimits')
      .withIndex('by_key', (q) => q.eq('key', GLOBAL_KEY)).unique();
    // A stale action must not release a newer action's lease or write its cache.
    if (!global || global.leaseId !== args.leaseId) return;
    const now = Date.now();
    await ctx.db.patch(global._id, {
      leaseId: undefined, leaseExpiresAt: undefined, nextAllowedAt: now + GAP_MS,
      requestCount: 0,
    });
    if (args.results !== undefined) {
      const cached = await ctx.db.query('geocodingCache')
        .withIndex('by_key', (q) => q.eq('key', args.key)).unique();
      const fields = {
        key: args.key, results: args.results,
        expiresAt: now + (args.results.length ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS),
      };
      if (cached) await ctx.db.patch(cached._id, fields);
      else await ctx.db.insert('geocodingCache', fields);
    }
  },
});

function parseResult(value: unknown): GeocodingResult {
  if (!value || typeof value !== 'object') throw new Error('Malformed geocoding result');
  const raw = value as Record<string, unknown>;
  if (typeof raw.place_id !== 'number' || !Number.isSafeInteger(raw.place_id) || raw.place_id < 0 ||
      typeof raw.display_name !== 'string' || !raw.display_name.trim() || raw.display_name.length > 1000 ||
      typeof raw.lat !== 'string' || !raw.lat.trim() || typeof raw.lon !== 'string' || !raw.lon.trim()) {
    throw new Error('Malformed geocoding result');
  }
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  normalizeCoordinates(lat, lon);
  const address = raw.address && typeof raw.address === 'object'
    ? raw.address as Record<string, unknown> : null;
  const road = typeof address?.road === 'string' && address.road.length <= 200
    ? address.road : undefined;
  return { place_id: raw.place_id, display_name: raw.display_name, lat: String(lat), lon: String(lon), ...(road ? { road } : {}) };
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Missing geocoding response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Geocoding response too large');
    }
    text += decoder.decode(part.value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text);
}

async function requestGeocoding(
  ctx: ActionCtx, sessionToken: string, base: URL, route: 'search' | 'reverse', params: URLSearchParams,
): Promise<GeocodingResult[]> {
  const url = new URL(route, base);
  url.search = params.toString();
  const cacheParams = new URLSearchParams(params);
  if (route === 'search') cacheParams.set('q', (params.get('q') ?? '').toLowerCase());
  const key = `${url.origin}${url.pathname}:${cacheParams.toString()}`;
  const reservation: Reservation = await ctx.runMutation(internal.geocoding.reserve, { sessionToken, key });
  if (reservation.kind === 'cached') return reservation.results;
  if (reservation.kind === 'busy') {
    throw new ConvexError('Place search is busy. Wait a moment, then submit your search again.');
  }
  if (reservation.kind === 'limited') {
    throw new ConvexError('You have reached the search limit. Wait a minute before searching again.');
  }
  // An action delayed after reservation may not start a request near/after expiry.
  // There are no awaits between this check and starting the upstream request.
  let results: GeocodingResult[] | undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    if (Date.now() + FETCH_TIMEOUT_MS >= reservation.leaseExpiresAt) {
      throw new Error('Geocoding lease expired before fetch');
    }
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json', 'Accept-Language': 'en',
        'User-Agent': 'Curbwise/0.1 (+https://curbwise.onrender.com)',
      },
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Geocoding provider unavailable');
    const raw = await readJson(response);
    if (route === 'search') {
      if (!Array.isArray(raw)) throw new Error('Malformed geocoding response');
      results = raw.slice(0, 5).map(parseResult);
    } else {
      results = [parseResult(raw)];
    }
    return results;
  } catch {
    throw new ConvexError('Place search is unavailable right now. Please try again later or choose a location on the map.');
  } finally {
    clearTimeout(timeout);
    // Errors are not empty search results and must never be cached as success.
    await ctx.runMutation(internal.geocoding.finish, { leaseId: reservation.leaseId, key, results });
  }
}

export const search = action({
  args: { sessionToken: v.string(), query: v.string() },
  returns: v.array(resultValidator),
  handler: async (ctx, args): Promise<GeocodingResult[]> => {
    const query = normalizeQuery(args.query);
    return requestGeocoding(ctx, args.sessionToken, configuredBaseUrl(), 'search', new URLSearchParams({
      format: 'jsonv2', q: query, limit: '5', addressdetails: '1',
    }));
  },
});

export const reverse = action({
  args: { sessionToken: v.string(), lat: v.number(), lng: v.number() },
  returns: v.array(resultValidator),
  handler: async (ctx, args): Promise<GeocodingResult[]> => {
    const point = normalizeCoordinates(args.lat, args.lng);
    return requestGeocoding(ctx, args.sessionToken, configuredBaseUrl(), 'reverse', new URLSearchParams({
      format: 'jsonv2', ...point, zoom: '18', addressdetails: '1',
    }));
  },
});

export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db.query('geocodingCache')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now)).take(100);
    for (const row of expired) await ctx.db.delete(row._id);
    const inactive = await ctx.db.query('geocodingLimits')
      .withIndex('by_windowStartedAt', (q) => q.lt('windowStartedAt', now - 24 * 60 * 60 * 1000)).take(100);
    for (const row of inactive) {
      if (row.key !== GLOBAL_KEY) await ctx.db.delete(row._id);
    }
  },
});
