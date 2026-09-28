import type { Id } from '../convex/_generated/dataModel';

export const ASSISTANCE_MODEL = 'jev-1.13.0';
export const ASSISTANCE_CRITERIA_VERSION = 'report-intake-v1';
export const ASSISTANCE_UNAVAILABLE = 'Suggestions are unavailable right now. You can still choose an issue and submit your report.';
export const FOLLOW_UPS = {
  location: 'Where exactly is the issue—for example, which corner or side of the street?',
  timing: 'When did you notice it, and does it happen repeatedly?',
  impact: 'How does this affect people using the street or sidewalk?',
} as const;

export interface AssistanceInput {
  description: string;
  lat: number;
  lng: number;
}

export interface AssistanceResult {
  id: Id<'reportAssistance'>;
  suggestedIssueType: string | null;
  followUps: (keyof typeof FOLLOW_UPS)[];
  relatedReports: { id: Id<'hotspots'>; title: string }[];
}
