// Open311 (GeoReport v2) adapter — primarily for Chicago
// Docs: http://wiki.open311.org/GeoReport_v2/

const CHICAGO_ENDPOINT = 'https://311api.cityofchicago.org/open311/v2';
const CHICAGO_JURISDICTION = 'cityofchicago.org';

export interface Open311Service {
  service_code: string;
  service_name: string;
  description: string;
  type: 'realtime' | 'batch' | 'blackbox';
}

interface Open311ServiceRequest {
  service_request_id: string;
  token?: string;
  status: string;
}

/** Fetch available service types from Open311 endpoint. */
export async function getOpen311Services(): Promise<Open311Service[]> {
  try {
    const res = await fetch(
      `${CHICAGO_ENDPOINT}/services.json?jurisdiction_id=${CHICAGO_JURISDICTION}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

import { getIssueTypeConfig } from '@/lib/config/issue-types';

// Legacy fallback map for categories without IssueTypeConfig
const LEGACY_SERVICE_CODES: Record<string, string> = {
  'dangerous-intersection': '4fd3b167e750846744000005',
  'poor-sidewalk': '4fd3b656e750846c53000004',
  'accessibility': '4fd6e4ece750840569000019',
  'speeding': '4ffa4c69601827691b000018',
  'needs-bike-lane': '4fd3b656e750846c53000004',
  'transit-gap': '4fd3b656e750846c53000004',
  'other': '4fd3b656e750846c53000004',
};

/** Resolve a 311 service code — checks IssueTypeConfig first, falls back to legacy map. */
function resolveServiceCode(category: string, issueType?: string): string {
  if (issueType) {
    const config = getIssueTypeConfig(issueType);
    if (config?.open311Hint) return config.open311Hint;
  }
  return LEGACY_SERVICE_CODES[category] ?? LEGACY_SERVICE_CODES['other'];
}

/** Submit a service request to Chicago's Open311 endpoint. */
export async function submitToOpen311(input: {
  lat: number;
  lng: number;
  address: string;
  category: string;
  title: string;
  description: string;
  issueType?: string;
}): Promise<{
  success: boolean;
  trackingId?: string;
  trackingUrl?: string;
  error?: string;
}> {
  try {
    const serviceCode = resolveServiceCode(input.category, input.issueType);

    const formData = new URLSearchParams();
    formData.append('jurisdiction_id', CHICAGO_JURISDICTION);
    formData.append('service_code', serviceCode);
    formData.append('lat', String(input.lat));
    formData.append('long', String(input.lng));
    formData.append('address_string', input.address);
    formData.append('description', `${input.title}\n\n${input.description}`);

    const res = await fetch(`${CHICAGO_ENDPOINT}/requests.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Open311 API error: ${res.status} — ${errorText}` };
    }

    const data: Open311ServiceRequest[] = await res.json();
    const request = data[0];
    if (!request) {
      return { success: false, error: 'No service request returned from Open311.' };
    }

    return {
      success: true,
      trackingId: request.service_request_id || request.token,
      trackingUrl: `https://311.chicago.gov/s/servicerequest/${request.service_request_id}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to submit to Open311: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
