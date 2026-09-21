/**
 * Community pilot coverage, not municipal jurisdiction boundaries.
 * Keep city-service routing separate: a metro-area report may belong to a suburb.
 */
export const REPORTING_AREAS = [
  {
    id: 'chicago',
    name: 'Chicago',
    bounds: { south: 41.6, west: -88.0, north: 42.1, east: -87.4 },
  },
  {
    id: 'denver',
    name: 'Denver',
    // Covers Denver's airport as well as the central metro pilot area.
    bounds: { south: 39.55, west: -105.15, north: 40.0, east: -104.55 },
  },
  {
    id: 'nyc',
    name: 'New York City',
    // Five-borough pilot envelope, including Staten Island and eastern Queens.
    bounds: { south: 40.49, west: -74.26, north: 40.92, east: -73.7 },
  },
] as const;

export function findReportingArea(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

  return REPORTING_AREAS.find(({ bounds }) =>
    lat >= bounds.south && lat <= bounds.north &&
    lng >= bounds.west && lng <= bounds.east,
  );
}
