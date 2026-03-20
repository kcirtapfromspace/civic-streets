// Core data model for Curbwise
// Frozen after Round 0 — all workstreams depend on these types

export type ElementType =
  | 'sidewalk'
  | 'planting-strip'
  | 'furniture-zone'
  | 'bike-lane'
  | 'bike-lane-protected'
  | 'buffer'
  | 'parking-lane'
  | 'travel-lane'
  | 'turn-lane'
  | 'transit-lane'
  | 'median'
  | 'curb';

export type FunctionalClass =
  | 'local'
  | 'collector'
  | 'minor-arterial'
  | 'major-arterial';

export type TemplateCategory =
  | 'road-diet'
  | 'protected-bike'
  | 'transit-priority'
  | 'complete-street'
  | 'shared-street';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ConstraintType = 'prowag' | 'nacto' | 'dimensional';

export type ElementSide = 'left' | 'right' | 'center';

export type StreetDirection = 'one-way' | 'two-way';

export type RenderMode = 'display' | 'export';

export interface DimensionalConstraint {
  absoluteMin: number;        // PROWAG hard minimum (feet)
  recommendedMin: number;     // NACTO recommended minimum
  recommended: number;        // NACTO ideal
  absoluteMax: number;        // practical maximum
  source: string;             // "NACTO USDG p.42"
  prowagRequired: boolean;    // ADA hard constraint flag
}

export interface CrossSectionElement {
  id: string;
  type: ElementType;
  side: ElementSide;
  width: number;              // feet
  constraints: DimensionalConstraint;
  locked: boolean;
  label?: string;
  variant?: string;
}

export interface StreetMetadata {
  createdAt: string;
  updatedAt: string;
  templateId?: string;
}

export interface StreetLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface StreetSegment {
  id: string;
  name: string;
  totalROWWidth: number;      // right-of-way width (feet)
  curbToCurbWidth: number;
  direction: StreetDirection;
  functionalClass: FunctionalClass;
  elements: CrossSectionElement[];
  metadata: StreetMetadata;
  location?: StreetLocation;
}

export interface ValidationResult {
  valid: boolean;
  severity: ValidationSeverity;
  elementId: string;
  constraint: ConstraintType;
  message: string;
  citation: string;           // "PROWAG R302.3"
  currentValue: number;
  requiredValue: number;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  applicableROWWidths: number[];
  applicableFunctionalClasses: FunctionalClass[];
  elements: Omit<CrossSectionElement, 'id'>[];
  tags: string[];
}

// ── Proposal flow types ──────────────────────────────────────────────────────

export interface BeforePreset {
  id: string;
  label: string;
  description: string;
  rowWidth: number;
  direction: StreetDirection;
  functionalClass: FunctionalClass;
  elements: Omit<CrossSectionElement, 'id'>[];
  suggestedTransformations: string[];
}

export interface StreetProposal {
  id: string;
  streetName: string;
  location: StreetLocation;
  roadPath: Array<{ lat: number; lng: number }>;
  bearing: number;
  beforePresetId: string;
  beforeStreet: StreetSegment;
  afterStreet: StreetSegment;
  transformationTemplateId: string;
  metadata: { createdAt: string; updatedAt: string };
}
