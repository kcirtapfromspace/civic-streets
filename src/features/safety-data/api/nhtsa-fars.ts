import type { DataSourceConfig } from '@/lib/types/safety-data';

// Verified against https://crashviewer.nhtsa.dot.gov/CrashAPI on 2026-09-14:
// GetCrashesByLocation accepts state/county, not the lat/lng/radius parameters
// used by the former adapter. Until we resolve jurisdictions and handle its
// 5,000-record cap, do not issue an unbounded query or imply map coverage.
export const farsSource: DataSourceConfig = {
  id: 'fars',
  name: 'NHTSA FARS — map coverage not connected',
  bounds: [24.396, -125.0, 49.384, -66.934],
  fetch: async () => {
    throw new Error('National fatal-crash map coverage is not connected for this location. Use the official NHTSA viewer.');
  },
  coverage: 'fatal-only',
  coverageNote: 'NHTSA publishes fatal-crash data. This map has no verified national location query; nonfatal crash data is not supplied by FARS.',
  city: 'Contiguous US',
  citation: 'NHTSA Fatality Analysis Reporting System (FARS)',
  dateRange: 'No national records loaded in this map',
  url: 'https://cdan.dot.gov/query',
};
