// Unified civic reporting interface — routes issues to the right city system

import { submitToSeeClickFix, getSeeClickFixCategories, type SeeClickFixCategory } from './civic/seeclickfix';
import { submitToOpen311, getOpen311Services, type Open311Service } from './civic/open311';
import { getCityDeepLink, type DeepLinkCity } from './civic/deeplinks';

export type CivicServiceTier = 'seeclickfix' | 'open311' | 'deeplink';

export interface CivicCategory {
  id: string;
  name: string;
  description?: string;
}

export interface CivicReportInput {
  lat: number;
  lng: number;
  address: string;
  category: string;
  title: string;
  description: string;
  photoUrls?: string[];
}

export interface CivicReportResult {
  success: boolean;
  trackingId?: string;
  trackingUrl?: string;
  deepLinkUrl?: string;
  error?: string;
}

interface CivicServiceConfig {
  id: CivicServiceTier;
  name: string;
  city: string;
  bounds: [number, number, number, number]; // [south, west, north, east]
}

// City service configurations
const CIVIC_SERVICES: CivicServiceConfig[] = [
  {
    id: 'open311',
    name: 'Chicago 311',
    city: 'Chicago',
    bounds: [41.6, -87.9, 42.1, -87.5], // Chicago metro
  },
  {
    id: 'seeclickfix',
    name: 'SeeClickFix',
    city: 'Denver',
    bounds: [39.6, -105.1, 39.9, -104.8], // Denver metro
  },
  // Other SCF cities can be added here
];

/** Detect which civic service covers a given location. */
export function detectCivicService(lat: number, lng: number): CivicServiceConfig | null {
  return CIVIC_SERVICES.find(
    (s) => lat >= s.bounds[0] && lat <= s.bounds[2] && lng >= s.bounds[1] && lng <= s.bounds[3],
  ) ?? null;
}

/** Get available categories for a location. */
export async function getCivicCategories(lat: number, lng: number): Promise<CivicCategory[]> {
  const service = detectCivicService(lat, lng);

  if (!service) return [];

  switch (service.id) {
    case 'seeclickfix': {
      const cats = await getSeeClickFixCategories(lat, lng);
      return cats.map((c: SeeClickFixCategory) => ({
        id: String(c.id),
        name: c.title,
        description: c.description,
      }));
    }
    case 'open311': {
      const services = await getOpen311Services();
      return services.map((s: Open311Service) => ({
        id: s.service_code,
        name: s.service_name,
        description: s.description,
      }));
    }
    default:
      return [];
  }
}

/** Submit a civic report to the appropriate service. */
export async function submitCivicReport(input: CivicReportInput): Promise<CivicReportResult> {
  const service = detectCivicService(input.lat, input.lng);

  // No API service — return deep link
  if (!service) {
    const deepLink = getCityDeepLink(input.lat, input.lng, input.address, input.description);
    if (deepLink) {
      return {
        success: true,
        deepLinkUrl: deepLink.url,
      };
    }
    return {
      success: false,
      error: 'No civic reporting service found for this location. Try your city\'s 311 website directly.',
    };
  }

  switch (service.id) {
    case 'seeclickfix':
      return submitToSeeClickFix(input);
    case 'open311':
      return submitToOpen311(input);
    case 'deeplink': {
      const deepLink = getCityDeepLink(input.lat, input.lng, input.address, input.description);
      return deepLink
        ? { success: true, deepLinkUrl: deepLink.url }
        : { success: false, error: 'No deep link available for this location.' };
    }
    default:
      return { success: false, error: 'Unknown service tier.' };
  }
}
