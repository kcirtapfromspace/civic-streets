// Community feature types — shared across map, hotspots, reports

// ── New 2-level issue type system ────────────────────────────────────────

export type IssueGroup =
  | 'road-surface'
  | 'sidewalk'
  | 'signal-sign'
  | 'bike'
  | 'obstruction'
  | 'safety'
  | 'transit'
  | 'other';

export type IssueType = string;

export interface IssueTypeConfig {
  slug: IssueType;
  label: string;
  group: IssueGroup;
  defaultSeverity: HotspotSeverity;
  open311Hint?: string;
  scfKeywords?: string[];
}

export const ISSUE_GROUP_LABELS: Record<IssueGroup, string> = {
  'road-surface': 'Road & Surface',
  'sidewalk': 'Sidewalk & Path',
  'signal-sign': 'Signal & Sign',
  'bike': 'Bike Infrastructure',
  'obstruction': 'Blocked / Obstructed',
  'safety': 'Dangerous Spot',
  'transit': 'Transit',
  'other': 'Other',
};

export const ISSUE_GROUP_COLORS: Record<IssueGroup, string> = {
  'road-surface': '#CA8A04',
  'sidewalk': '#EA580C',
  'signal-sign': '#DC2626',
  'bike': '#16A34A',
  'obstruction': '#9333EA',
  'safety': '#DC2626',
  'transit': '#2563EB',
  'other': '#6B7280',
};

// ── Legacy category system (deprecated — use IssueGroup/IssueType) ───────

export type HotspotCategory =
  | 'dangerous-intersection'
  | 'needs-bike-lane'
  | 'speeding'
  | 'poor-sidewalk'
  | 'transit-gap'
  | 'accessibility'
  | 'other';

export type AccessibilitySubtype =
  | 'missing-curb-ramp'
  | 'broken-sidewalk'
  | 'obstructed-sidewalk'
  | 'inaccessible-bus-stop'
  | 'missing-tactile-paving'
  | 'non-ada-crossing-signal'
  | 'step-at-transit-entrance';

export type HotspotSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Map new IssueGroup to legacy HotspotCategory for backward compat */
export function issueGroupToLegacyCategory(group: IssueGroup): HotspotCategory {
  const map: Record<IssueGroup, HotspotCategory> = {
    'road-surface': 'poor-sidewalk',
    'sidewalk': 'poor-sidewalk',
    'signal-sign': 'dangerous-intersection',
    'bike': 'needs-bike-lane',
    'obstruction': 'other',
    'safety': 'dangerous-intersection',
    'transit': 'transit-gap',
    'other': 'other',
  };
  return map[group];
}

export type HotspotStatus = 'open' | 'acknowledged' | 'in-progress' | 'resolved';

export type ReportStatus = 'draft' | 'sent' | 'delivered' | 'responded';

export interface MapLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface HotspotPin {
  id: string;
  title: string;
  category: HotspotCategory;
  severity: HotspotSeverity;
  status: HotspotStatus;
  lat: number;
  lng: number;
  upvotes: number;
  commentCount: number;
}

export interface DesignPin {
  id: string;
  title: string;
  lat: number;
  lng: number;
  upvotes: number;
  prowagPass: boolean;
  templateId?: string;
}

export interface RepInfo {
  name: string;
  title: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  office?: string;
}

export const HOTSPOT_CATEGORY_LABELS: Record<HotspotCategory, string> = {
  'dangerous-intersection': 'Dangerous Intersection',
  'needs-bike-lane': 'Needs Bike Lane',
  'speeding': 'Speeding Problem',
  'poor-sidewalk': 'Poor Sidewalk',
  'transit-gap': 'Transit Gap',
  'accessibility': 'Accessibility Issue',
  'other': 'Other',
};

export const HOTSPOT_CATEGORY_COLORS: Record<HotspotCategory, string> = {
  'dangerous-intersection': '#DC2626',
  'needs-bike-lane': '#16A34A',
  'speeding': '#EA580C',
  'poor-sidewalk': '#CA8A04',
  'transit-gap': '#2563EB',
  'accessibility': '#9333EA',
  'other': '#6B7280',
};

export const SEVERITY_LABELS: Record<HotspotSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const ACCESSIBILITY_SUBTYPE_LABELS: Record<AccessibilitySubtype, string> = {
  'missing-curb-ramp': 'Missing Curb Ramp',
  'broken-sidewalk': 'Broken Sidewalk',
  'obstructed-sidewalk': 'Obstructed Sidewalk',
  'inaccessible-bus-stop': 'Inaccessible Bus Stop',
  'missing-tactile-paving': 'Missing Tactile Paving',
  'non-ada-crossing-signal': 'Non-ADA Crossing Signal',
  'step-at-transit-entrance': 'Step at Transit Entrance',
};
