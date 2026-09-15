import type { CrashFetchResult } from '@/lib/types/safety-data';

// Cache completed requests, including successful empty responses. Failed requests
// never enter the cache; date or viewport changes use a different key.
const MAX_ENTRIES = 40;
const TTL_MS = 5 * 60_000;
const entries = new Map<string, { result: CrashFetchResult; expiresAt: number }>();

export const crashCache = {
  get(key: string): CrashFetchResult | undefined {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) { entries.delete(key); return undefined; }
    return entry.result;
  },
  set(key: string, result: CrashFetchResult): void {
    entries.delete(key);
    entries.set(key, { result, expiresAt: Date.now() + TTL_MS });
    if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  },
  clear(): void { entries.clear(); },
};
