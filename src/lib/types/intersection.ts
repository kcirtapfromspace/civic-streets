import type { CrashMode, CrashSeverity } from './safety-data';

export type TrafficControl =
  | 'uncontrolled'
  | 'yield'
  | 'two-way-stop'
  | 'all-way-stop'
  | 'signalized'
  | 'roundabout';

export type CrossingType =
  | 'none'
  | 'unmarked'
  | 'standard-crosswalk'
  | 'high-visibility-crosswalk'
  | 'raised-crosswalk';

export type IntersectionShape = 'T' | 'four-way' | 'five-way' | 'offset';

export type ImprovementCategory =
  | 'traffic-control'
  | 'pedestrian'
  | 'accessibility'
  | 'transit'
  | 'safety'
  | 'cycling';

export interface IntersectionConditions {
  shape: IntersectionShape;
  trafficControl: TrafficControl;
  crossingType: CrossingType;
  hasCurbRamps: boolean;
  hasPedestrianSignal: boolean;
  hasTransitStop: boolean;
}

export interface IntersectionImprovement {
  id: string;
  category: ImprovementCategory;
  label: string;
  description: string;
  icon: string;
  relevantCrashModes: CrashMode[];
  relevantSeverities: CrashSeverity[];
  minimumCrashThreshold: number;
  complexity: 'quick-win' | 'moderate' | 'major';
  excludes?: string[];
  requires?: string[];
}

export interface CrashSummary {
  totalCrashes: number;
  fatalities: number;
  severeInjuries: number;
  pedestrianCrashes: number;
  cyclistCrashes: number;
  motoristCrashes: number;
  radiusMeters: number;
}

export interface IntersectionProposal {
  id: string;
  intersectionName: string;
  location: { lat: number; lng: number; address: string };
  center: { lat: number; lng: number };
  conditions: IntersectionConditions;
  selectedImprovements: string[];
  nearbyCrashSummary: CrashSummary;
  metadata: { createdAt: string; updatedAt: string };
}
