import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPlaces, type GeocodingResult } from './geocoding';

const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 40;
const cache = new Map<string, { results: GeocodingResult[]; expiresAt: number }>();

export function clearPlaceSearchCache(): void { cache.clear(); }

/** Explicit submitted searches through the configured server proxy only.
 * This local cache is an optimization; provider limits are enforced server-side.
 */
export function useSubmittedPlaceSearch() {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const requestVersion = useRef(0);
  const pendingQuery = useRef<string | null>(null);

  const clearResults = useCallback(() => {
    requestVersion.current++;
    pendingQuery.current = null;
    setResults([]); setError(null); setIsLoading(false); setHasSearched(false);
  }, []);
  const setQuery = useCallback((value: string) => {
    clearResults();
    setQueryState(value);
  }, [clearResults]);

  useEffect(() => () => { requestVersion.current++; }, []);

  const search = useCallback(async () => {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (pendingQuery.current === trimmed) return;
    const version = ++requestVersion.current;
    setError(null); setResults([]); setHasSearched(true);
    if (trimmed.length < 3) {
      setError('Enter at least 3 characters to search.'); setIsLoading(false); return;
    }
    const key = trimmed.toLocaleLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      setResults(cached.results); setIsLoading(false); return;
    }
    if (cached) cache.delete(key);
    pendingQuery.current = trimmed;
    setIsLoading(true);
    try {
      const found = await searchPlaces(trimmed);
      if (version !== requestVersion.current) return;
      cache.delete(key);
      cache.set(key, { results: found, expiresAt: Date.now() + CACHE_TTL_MS });
      if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
      setResults(found);
    } catch (failure) {
      if (version !== requestVersion.current) return;
      setError(failure instanceof Error ? failure.message : 'Place search is unavailable. Please try again.');
    } finally {
      if (version === requestVersion.current) {
        pendingQuery.current = null;
        setIsLoading(false);
      }
    }
  }, [query]);

  return { query, setQuery, results, isLoading, error, hasSearched, search, clearResults };
}
