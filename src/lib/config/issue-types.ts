import type { IssueTypeConfig, IssueGroup } from '@/lib/types/community';

// ── Issue type config — single source of truth ──────────────────────────
// Each entry defines a subtype within an IssueGroup, its default severity,
// and optional hints for 311/SeeClickFix routing.

export const ISSUE_TYPES: IssueTypeConfig[] = [
  // ── Road & Surface ──────────────────────────────────────────────────
  { slug: 'pothole', label: 'Pothole', group: 'road-surface', defaultSeverity: 'medium', open311Hint: '4fd3b656e750846c53000004', scfKeywords: ['pothole', 'road'] },
  { slug: 'cracked-pavement', label: 'Cracked Pavement', group: 'road-surface', defaultSeverity: 'low', scfKeywords: ['pavement', 'cracked road'] },
  { slug: 'flooding', label: 'Flooding / Drainage', group: 'road-surface', defaultSeverity: 'medium', scfKeywords: ['flooding', 'drainage', 'standing water'] },
  { slug: 'utility-cover', label: 'Damaged Utility Cover', group: 'road-surface', defaultSeverity: 'high', scfKeywords: ['manhole', 'utility'] },

  // ── Sidewalk & Path ─────────────────────────────────────────────────
  { slug: 'cracked-sidewalk', label: 'Cracked Sidewalk', group: 'sidewalk', defaultSeverity: 'medium', open311Hint: '4fd3b656e750846c53000004', scfKeywords: ['sidewalk', 'cracked'] },
  { slug: 'heaved-sidewalk', label: 'Heaved / Uneven', group: 'sidewalk', defaultSeverity: 'medium', scfKeywords: ['sidewalk', 'uneven', 'heaved'] },
  { slug: 'missing-sidewalk', label: 'Missing Sidewalk', group: 'sidewalk', defaultSeverity: 'high', scfKeywords: ['sidewalk', 'missing'] },
  { slug: 'no-curb-ramp', label: 'No Curb Ramp', group: 'sidewalk', defaultSeverity: 'high', open311Hint: '4fd6e4ece750840569000019', scfKeywords: ['curb ramp', 'ada', 'accessibility'] },
  { slug: 'blocked-sidewalk', label: 'Blocked Sidewalk', group: 'sidewalk', defaultSeverity: 'medium', scfKeywords: ['sidewalk', 'obstructed', 'blocked'] },

  // ── Signal & Sign ───────────────────────────────────────────────────
  { slug: 'broken-signal', label: 'Broken Signal', group: 'signal-sign', defaultSeverity: 'high', open311Hint: '4fd3b167e750846744000005', scfKeywords: ['traffic signal', 'broken signal'] },
  { slug: 'missing-sign', label: 'Missing Sign', group: 'signal-sign', defaultSeverity: 'medium', scfKeywords: ['sign', 'missing sign'] },
  { slug: 'faded-crosswalk', label: 'Faded Crosswalk', group: 'signal-sign', defaultSeverity: 'medium', scfKeywords: ['crosswalk', 'faded', 'worn'] },
  { slug: 'mistimed-signal', label: 'Mistimed Signal', group: 'signal-sign', defaultSeverity: 'medium', scfKeywords: ['signal timing', 'traffic signal'] },

  // ── Bike Infrastructure ─────────────────────────────────────────────
  { slug: 'damaged-bike-lane', label: 'Damaged Bike Lane', group: 'bike', defaultSeverity: 'medium', scfKeywords: ['bike lane', 'bicycle'] },
  { slug: 'missing-bike-rack', label: 'Missing Bike Rack', group: 'bike', defaultSeverity: 'low', scfKeywords: ['bike rack', 'bicycle parking'] },
  { slug: 'needs-bike-lane', label: 'Needs Bike Lane', group: 'bike', defaultSeverity: 'medium', scfKeywords: ['bike', 'bicycle', 'cycling'] },

  // ── Blocked / Obstructed ────────────────────────────────────────────
  { slug: 'debris', label: 'Debris in Road', group: 'obstruction', defaultSeverity: 'medium', scfKeywords: ['debris', 'road debris'] },
  { slug: 'vehicle-blocking', label: 'Vehicle Blocking', group: 'obstruction', defaultSeverity: 'medium', scfKeywords: ['vehicle', 'blocking', 'parked'] },
  { slug: 'overgrown-vegetation', label: 'Overgrown Vegetation', group: 'obstruction', defaultSeverity: 'low', scfKeywords: ['overgrown', 'vegetation', 'tree'] },
  { slug: 'downed-tree', label: 'Downed Tree', group: 'obstruction', defaultSeverity: 'high', scfKeywords: ['tree', 'fallen tree', 'downed'] },
  { slug: 'snow-ice', label: 'Snow / Ice', group: 'obstruction', defaultSeverity: 'medium', scfKeywords: ['snow', 'ice', 'icy'] },

  // ── Dangerous Spot ──────────────────────────────────────────────────
  { slug: 'dangerous-intersection', label: 'Dangerous Intersection', group: 'safety', defaultSeverity: 'critical', open311Hint: '4fd3b167e750846744000005', scfKeywords: ['intersection', 'pedestrian', 'crosswalk'] },
  { slug: 'speeding', label: 'Speeding Problem', group: 'safety', defaultSeverity: 'high', open311Hint: '4ffa4c69601827691b000018', scfKeywords: ['speed', 'traffic calming'] },
  { slug: 'poor-lighting', label: 'Poor Lighting', group: 'safety', defaultSeverity: 'medium', scfKeywords: ['lighting', 'dark', 'street light'] },
  { slug: 'school-zone', label: 'School Zone Concern', group: 'safety', defaultSeverity: 'high', scfKeywords: ['school', 'school zone', 'children'] },

  // ── Transit ─────────────────────────────────────────────────────────
  { slug: 'missing-shelter', label: 'Missing Shelter', group: 'transit', defaultSeverity: 'medium', scfKeywords: ['bus shelter', 'transit shelter'] },
  { slug: 'damaged-stop', label: 'Damaged Stop', group: 'transit', defaultSeverity: 'medium', scfKeywords: ['bus stop', 'damaged'] },
  { slug: 'inaccessible-stop', label: 'Inaccessible Stop', group: 'transit', defaultSeverity: 'high', scfKeywords: ['bus stop', 'accessibility', 'ada'] },
  { slug: 'service-gap', label: 'Service Gap', group: 'transit', defaultSeverity: 'medium', scfKeywords: ['transit', 'bus', 'service'] },

  // ── Other ───────────────────────────────────────────────────────────
  { slug: 'other', label: 'Other', group: 'other', defaultSeverity: 'medium', scfKeywords: ['other', 'general'] },
];

/** Get all issue types for a given group */
export function getIssueTypesByGroup(group: IssueGroup): IssueTypeConfig[] {
  return ISSUE_TYPES.filter((t) => t.group === group);
}

/** Look up an issue type config by slug */
export function getIssueTypeConfig(slug: string): IssueTypeConfig | undefined {
  return ISSUE_TYPES.find((t) => t.slug === slug);
}

/** Group icons — SVG path data for the 8 group tiles */
export const ISSUE_GROUP_ICONS: Record<IssueGroup, string> = {
  'road-surface': 'M3 12h2l2-4h10l2 4h2M7 16h10M9 20h6',
  'sidewalk': 'M3 21h18M5 21V7l8-4 8 4v14',
  'signal-sign': 'M12 3v18M8 7h8M8 11h8M8 15h8',
  'bike': 'M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 15l7-8 4 4 3-3',
  'obstruction': 'M12 9v4m0 4h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z',
  'safety': 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'transit': 'M8 6v6h8V6M6 18h12M9 18v3M15 18v3M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  'other': 'M12 6v6m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
};
