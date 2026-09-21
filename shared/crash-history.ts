/** Calendar-month archive: current UTC month plus the preceding eleven. */
export type CrashCity = 'chi' | 'nyc' | 'denver';
export const CRASH_CITIES: CrashCity[] = ['chi', 'nyc', 'denver'];
export function historyMonths(now: number): string[] {
  const date = new Date(now);
  return Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
}
export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid archive month');
  const start = `${month}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, next: next.toISOString().slice(0, 10), end: new Date(next.getTime() - 86400000).toISOString().slice(0, 10) };
}
export interface CrashHistoryMonth {
  month: string;
  count: number | null;
  fatalities: number | null;
  syncedAt: number | null;
  skipped: number;
  status: 'ready' | 'pending' | 'error';
}
export interface CrashHistory {
  months: CrashHistoryMonth[];
  latestRecord: string | null;
  lastSuccess: number | null;
}
