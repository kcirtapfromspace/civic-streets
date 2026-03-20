// Community feature types — shared across map, hotspots, reports

export type HotspotCategory =
  | 'dangerous-intersection'
  | 'needs-bike-lane'
  | 'speeding'
  | 'poor-sidewalk'
  | 'transit-gap'
  | 'accessibility'
  | 'other';

export type HotspotSeverity = 'low' | 'medium' | 'high' | 'critical';

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
