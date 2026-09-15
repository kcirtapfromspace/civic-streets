import type { CrashBounds, CrashDateRange } from '@/lib/types/safety-data';

export function validateBounds(bounds: CrashBounds): void {
  if (!Object.values(bounds).every(Number.isFinite)
    || bounds.south < -90 || bounds.north > 90
    || bounds.west < -180 || bounds.east > 180
    || bounds.south >= bounds.north || bounds.west >= bounds.east) {
    throw new Error('Choose a smaller map area with valid coordinates.');
  }
}

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function validateDateRange(range?: CrashDateRange | null): void {
  if (range && (!validDate(range.start) || !validDate(range.end) || range.start > range.end)) {
    throw new Error('Choose a valid start and end date.');
  }
}

export function nextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function inBounds(lat: number, lng: number, bounds: CrashBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

export function socrataDateFilter(range?: CrashDateRange | null): string[] {
  validateDateRange(range);
  return range ? [
    `crash_date >= '${range.start}T00:00:00'`,
    `crash_date < '${nextDate(range.end)}T00:00:00'`,
  ] : [];
}
