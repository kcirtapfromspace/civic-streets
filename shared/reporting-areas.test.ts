import { describe, expect, it } from 'vitest';
import { findReportingArea } from './reporting-areas';

describe('community pilot reporting coverage', () => {
  it.each([
    ['Denver', 'denver', 39.7392, -104.9903],
    ['Denver airport', 'denver', 39.8561, -104.6737],
    ['Manhattan', 'nyc', 40.71, -74.01],
    ['Staten Island', 'nyc', 40.58, -74.15],
    ['Queens', 'nyc', 40.73, -73.8],
    ['Chicago', 'chicago', 41.881, -87.629],
  ])('recognizes %s', (_name, id, lat, lng) => {
    expect(findReportingArea(lat, lng)?.id).toBe(id);
  });

  it.each([
    [
      'denver',
      [
        [39.55, -105.15],
        [40, -104.55],
        [39.55, -104.8],
        [40, -104.8],
        [39.7, -105.15],
        [39.7, -104.55],
      ],
    ],
    [
      'chicago',
      [
        [41.6, -88],
        [42.1, -87.4],
        [41.6, -87.6],
        [42.1, -87.6],
        [41.8, -88],
        [41.8, -87.4],
      ],
    ],
    ['nyc', [[40.49, -74.26], [40.92, -73.7], [40.7, -74.26], [40.7, -73.7]]],
  ] as const)('includes the approved boundary coordinates for %s', (id, points) => {
    for (const [lat, lng] of points) expect(findReportingArea(lat, lng)?.id).toBe(id);
  });

  it.each([
    [
      'Denver',
      [
        [39.5499, -104.8],
        [40.0001, -104.8],
        [39.7, -105.1501],
        [39.7, -104.5499],
      ],
    ],
    [
      'Chicago',
      [
        [41.5999, -87.6],
        [42.1001, -87.6],
        [41.8, -88.0001],
        [41.8, -87.3999],
      ],
    ],
    ['NYC', [[40.4899, -74], [40.9201, -74], [40.7, -74.2601], [40.7, -73.6999]]],
  ] as const)('excludes points immediately outside each %s boundary', (_name, points) => {
    for (const [lat, lng] of points) expect(findReportingArea(lat, lng)).toBeUndefined();
  });

  it('does not combine the latitude of one pilot with the longitude of another', () => {
    expect(findReportingArea(39.7392, -87.629)).toBeUndefined();
    expect(findReportingArea(41.881, -104.9903)).toBeUndefined();
    expect(findReportingArea(34.05, -118.24)).toBeUndefined();
  });

  it.each([
    [NaN, -104.99],
    [Infinity, -104.99],
    [-Infinity, -104.99],
    [39.74, NaN],
    [39.74, Infinity],
    [39.74, -Infinity],
  ])('rejects nonfinite coordinates (%s,%s)', (lat, lng) => {
    expect(findReportingArea(lat, lng)).toBeUndefined();
  });
});
