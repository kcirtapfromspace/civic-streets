// Curated city 311 web form URLs for deep link fallback

export interface DeepLinkCity {
  name: string;
  url: string;
  bounds: [number, number, number, number]; // [south, west, north, east]
  prefillSupported: boolean;
}

const DEEP_LINK_CITIES: DeepLinkCity[] = [
  {
    name: 'New York City',
    url: 'https://portal.311.nyc.gov/sr-step1/',
    bounds: [40.4, -74.3, 40.95, -73.7],
    prefillSupported: false,
  },
  {
    name: 'Denver',
    url: 'https://www.denvergov.org/pocketgov311',
    bounds: [39.6, -105.1, 39.9, -104.8],
    prefillSupported: false,
  },
  {
    name: 'San Francisco',
    url: 'https://sf311.org/services',
    bounds: [37.7, -122.55, 37.83, -122.35],
    prefillSupported: false,
  },
  {
    name: 'Los Angeles',
    url: 'https://myla311.lacity.org/service-request',
    bounds: [33.7, -118.7, 34.35, -118.15],
    prefillSupported: false,
  },
  {
    name: 'Portland',
    url: 'https://www.portland.gov/transportation/report',
    bounds: [45.4, -122.85, 45.65, -122.45],
    prefillSupported: false,
  },
  {
    name: 'Seattle',
    url: 'https://www.seattle.gov/customer-service-bureau/find-it-fix-it-702',
    bounds: [47.49, -122.44, 47.74, -122.24],
    prefillSupported: false,
  },
  {
    name: 'Boston',
    url: 'https://311.boston.gov/',
    bounds: [42.2, -71.2, 42.4, -70.9],
    prefillSupported: false,
  },
  {
    name: 'Washington DC',
    url: 'https://311.dc.gov/',
    bounds: [38.79, -77.12, 38.99, -76.91],
    prefillSupported: false,
  },
];

/** Find the best deep link for a given location. */
export function getCityDeepLink(
  lat: number,
  lng: number,
  _address?: string,
  _description?: string,
): { city: string; url: string } | null {
  const city = DEEP_LINK_CITIES.find(
    (c) =>
      lat >= c.bounds[0] &&
      lat <= c.bounds[2] &&
      lng >= c.bounds[1] &&
      lng <= c.bounds[3],
  );

  if (!city) return null;

  // Future: append URL params for cities that support prefilling
  return { city: city.name, url: city.url };
}

/** Get all supported deep link cities. */
export function getAllDeepLinkCities(): DeepLinkCity[] {
  return DEEP_LINK_CITIES;
}
