import { ConvexHttpClient } from 'convex/browser';
import { ConvexError } from 'convex/values';
import { api } from '../../../convex/_generated/api';
import type { GeocodingResult } from '../../../shared/geocoding';
export type { GeocodingResult } from '../../../shared/geocoding';

let client: ConvexHttpClient | undefined;

function configuredClient() {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!url) throw new Error('Place search is not configured yet. You can choose a location on the map.');
  return client ??= new ConvexHttpClient(url.replace(/\/+$/, ''));
}

function sessionToken(): string {
  let token: string | null = null;
  try { token = localStorage.getItem('curbwise-session'); } catch { /* unavailable browser storage */ }
  if (!token) throw new Error('Your reporting session is still getting ready. Wait a moment, then search again.');
  return token;
}

function searchError(error: unknown): Error {
  if (error instanceof ConvexError && typeof error.data === 'string') return new Error(error.data);
  return new Error('Place search is unavailable right now. Please try again later or choose a location on the map.');
}

/** Call only for an explicit submitted search; never on each keystroke. */
export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  const session = sessionToken();
  const apiClient = configuredClient();
  try { return await apiClient.action(api.geocoding.search, { sessionToken: session, query }); }
  catch (error) { throw searchError(error); }
}

/** Call for a deliberate map selection, never on viewport/timer changes. */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<GeocodingResult | null> {
  const session = sessionToken();
  const apiClient = configuredClient();
  try {
    const results = await apiClient.action(api.geocoding.reverse, { sessionToken: session, lat, lng });
    return results[0] ?? null;
  } catch (error) { throw searchError(error); }
}
