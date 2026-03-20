// SeeClickFix API adapter
// Docs: https://seeclickfix.com/open311/v2/docs

const SCF_BASE = 'https://seeclickfix.com/api/v2';

export interface SeeClickFixCategory {
  id: number;
  title: string;
  description: string;
}

interface SeeClickFixIssueResponse {
  id: number;
  html_url: string;
  status: string;
}

/** Fetch available issue categories for a location. */
export async function getSeeClickFixCategories(
  lat: number,
  lng: number,
): Promise<SeeClickFixCategory[]> {
  try {
    const res = await fetch(
      `${SCF_BASE}/request_types?lat=${lat}&lng=${lng}&per_page=20`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.request_types ?? data ?? []).map((rt: Record<string, unknown>) => ({
      id: rt.id as number,
      title: (rt.title ?? rt.name ?? 'Unknown') as string,
      description: (rt.description ?? '') as string,
    }));
  } catch {
    return [];
  }
}

import { getIssueTypeConfig } from '@/lib/config/issue-types';

// Legacy keyword map — used when no IssueTypeConfig is available
const LEGACY_KEYWORDS: Record<string, string[]> = {
  'dangerous-intersection': ['intersection', 'traffic signal', 'crosswalk', 'pedestrian'],
  'needs-bike-lane': ['bike', 'bicycle', 'cycling'],
  'speeding': ['speed', 'traffic calming', 'traffic'],
  'poor-sidewalk': ['sidewalk', 'walkway', 'pavement'],
  'transit-gap': ['transit', 'bus', 'bus stop'],
  'accessibility': ['ada', 'accessibility', 'curb ramp', 'handicap'],
  'other': ['other', 'general'],
};

/** Find the best matching SeeClickFix category for a Curbwise category. */
export function matchCategory(
  curbwiseCategory: string,
  scfCategories: SeeClickFixCategory[],
  issueType?: string,
): SeeClickFixCategory | null {
  // Try IssueTypeConfig keywords first
  let keywords: string[] | undefined;
  if (issueType) {
    const config = getIssueTypeConfig(issueType);
    if (config?.scfKeywords?.length) keywords = config.scfKeywords;
  }
  if (!keywords) keywords = LEGACY_KEYWORDS[curbwiseCategory] ?? ['other'];

  for (const keyword of keywords) {
    const match = scfCategories.find(
      (c) =>
        c.title.toLowerCase().includes(keyword) ||
        c.description.toLowerCase().includes(keyword),
    );
    if (match) return match;
  }

  return scfCategories[0] ?? null;
}

/** Submit an issue to SeeClickFix. */
export async function submitToSeeClickFix(input: {
  lat: number;
  lng: number;
  address: string;
  category: string;
  title: string;
  description: string;
  photoUrls?: string[];
  issueType?: string;
}): Promise<{
  success: boolean;
  trackingId?: string;
  trackingUrl?: string;
  error?: string;
}> {
  try {
    // First, get available categories to find the right request_type_id
    const categories = await getSeeClickFixCategories(input.lat, input.lng);
    const matched = matchCategory(input.category, categories, input.issueType);

    const body: Record<string, unknown> = {
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      summary: input.title,
      description: input.description,
    };

    if (matched) {
      body.request_type_id = matched.id;
    }

    const res = await fetch(`${SCF_BASE}/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `SeeClickFix API error: ${res.status} — ${errorText}` };
    }

    const data: SeeClickFixIssueResponse = await res.json();
    return {
      success: true,
      trackingId: String(data.id),
      trackingUrl: data.html_url,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to submit to SeeClickFix: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
