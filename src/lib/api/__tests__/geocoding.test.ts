import { ConvexError } from 'convex/values';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocodeLocation, searchPlaces } from '../geocoding';

const { action } = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    action = action;
  },
}));
const result = {
  place_id: 1,
  display_name: 'Denver',
  lat: '39.74',
  lon: '-104.99',
  road: 'Broadway',
};

beforeEach(() => {
  vi.stubEnv('VITE_CONVEX_URL', 'https://test-deployment.convex.cloud');
  vi.stubGlobal('localStorage', { getItem: () => 'test-session' });
  vi.stubGlobal('fetch', vi.fn());
  action.mockReset().mockResolvedValue([result]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('geocoding client proxy', () => {
  it('sends a submitted query only to the authenticated Convex action', async () => {
    expect(await searchPlaces('Denver')).toEqual([result]);
    expect(getFunctionName(action.mock.calls[0][0])).toBe('geocoding:search');
    expect(action.mock.calls[0][1]).toEqual({ sessionToken: 'test-session', query: 'Denver' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the reverse action and preserves road metadata', async () => {
    expect(await reverseGeocodeLocation(39.74, -104.99)).toEqual(result);
    expect(getFunctionName(action.mock.calls[0][0])).toBe('geocoding:reverse');
    expect(action.mock.calls[0][1]).toEqual({
      sessionToken: 'test-session',
      lat: 39.74,
      lng: -104.99,
    });
  });

  it('does not bypass the proxy when a backend or session is unavailable', async () => {
    vi.stubEnv('VITE_CONVEX_URL', '');
    await expect(searchPlaces('Denver')).rejects.toThrow('not configured');
    vi.stubEnv('VITE_CONVEX_URL', 'https://test-deployment.convex.cloud');
    vi.stubGlobal('localStorage', { getItem: () => null });
    await expect(reverseGeocodeLocation(39.74, -104.99)).rejects.toThrow(
      'session is still getting ready',
    );
    expect(action).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces safe provider errors and never converts failures to empty results', async () => {
    action.mockRejectedValueOnce(new ConvexError('Place search is busy. Wait a moment.'));
    await expect(searchPlaces('Denver')).rejects.toThrow('Place search is busy');
    action.mockRejectedValueOnce(new Error('Internal server secret and stack trace'));
    await expect(searchPlaces('Denver')).rejects.toThrow('Place search is unavailable right now');
    expect(fetch).not.toHaveBeenCalled();
  });
});
