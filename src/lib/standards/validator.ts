// WS1: Standards Engine — validator
// Validates a StreetSegment against NACTO/PROWAG standards
import type {
  StreetSegment,
  ValidationResult,
  CrossSectionElement,
  ElementType,
} from '@/lib/types';
import nactoData from '../../../data/standards/nacto.json';
import prowagData from '../../../data/standards/prowag.json';

// ── Types ────────────────────────────────────────────────────────────────────

/** NACTO element constraint entry as stored in nacto.json */
export interface NactoElementConstraint {
  absoluteMin: number;
  recommendedMin: number;
  recommended: number;
  absoluteMax: number;
  source: string;
  prowagRequired: boolean;
  notes: string;
}

/** PROWAG requirement entry as stored in prowag.json */
export interface ProwagRequirement {
  description: string;
  minimumWidth?: number;
  appliesTo: string[];
  severity: 'error' | 'warning';
  citation: string;
  notes: string;
}

/** Loaded standards data exposed to other workstreams */
export interface StandardsData {
  nacto: {
    version: string;
    elements: Record<string, NactoElementConstraint>;
  };
  prowag: {
    version: string;
    requirements: Record<string, ProwagRequirement>;
  };
}

// ── Element types that live between the curbs ────────────────────────────────

const CURB_TO_CURB_TYPES: Set<ElementType> = new Set([
  'bike-lane',
  'bike-lane-protected',
  'buffer',
  'parking-lane',
  'travel-lane',
  'turn-lane',
  'transit-lane',
  'median',
]);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the NACTO and PROWAG JSON data files and return them as a typed
 * `StandardsData` object.
 */
export function loadStandards(): StandardsData {
  return {
    nacto: nactoData as StandardsData['nacto'],
    prowag: prowagData as StandardsData['prowag'],
  };
}

/**
 * Validate a `StreetSegment` against the loaded standards.
 *
 * Returns an array of `ValidationResult` objects covering:
 * 1. PROWAG hard constraints (error)
 * 2. NACTO recommended-minimum violations (warning)
 * 3. NACTO recommended guidance (info)
 * 4. Dimensional absolute-min/max violations (error)
 * 5. Total ROW width mismatch (error)
 * 6. Curb-to-curb width mismatch (warning)
 */
export function validateStreet(
  street: StreetSegment,
  standards: StandardsData,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const element of street.elements) {
    const nactoConstraint = standards.nacto.elements[element.type];
    if (!nactoConstraint) continue;

    // ── 1. PROWAG hard constraints ─────────────────────────────────────────
    results.push(...checkProwag(element, standards));

    // ── 2–3. NACTO recommended-min (warning) and recommended (info) ────────
    results.push(...checkNacto(element, nactoConstraint));

    // ── 4. Dimensional absolute-min / absolute-max (error) ─────────────────
    results.push(...checkDimensional(element, nactoConstraint));
  }

  // ── 5. Total ROW width check ─────────────────────────────────────────────
  results.push(...checkTotalWidth(street));

  // ── 6. Curb-to-curb width check ──────────────────────────────────────────
  results.push(...checkCurbToCurb(street));

  return results;
}

// ── Internal validation helpers ──────────────────────────────────────────────

/**
 * Check PROWAG requirements that apply to this element.
 * Only requirements with a `minimumWidth` produce a width-based result.
 */
function checkProwag(
  element: CrossSectionElement,
  standards: StandardsData,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [, req] of Object.entries(standards.prowag.requirements)) {
    if (!req.appliesTo.includes(element.type)) continue;
    if (req.minimumWidth === undefined) continue;

    if (element.width < req.minimumWidth) {
      results.push({
        valid: false,
        severity: req.severity,
        elementId: element.id,
        constraint: 'prowag',
        message: `${req.description}: ${element.type} width ${element.width} ft is below PROWAG minimum of ${req.minimumWidth} ft`,
        citation: req.citation,
        currentValue: element.width,
        requiredValue: req.minimumWidth,
      });
    }
  }

  return results;
}

/**
 * Check NACTO recommended-min (warning) and recommended (info) thresholds.
 *
 * These fire only when the element is NOT already violating a dimensional
 * absolute-min — that is, we only emit NACTO guidance when the width is at
 * least at the absolute minimum.
 */
function checkNacto(
  element: CrossSectionElement,
  nacto: NactoElementConstraint,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Only emit NACTO warnings/info when the element meets absolute-min.
  // Below absolute-min is already flagged as a dimensional error.
  if (element.width < nacto.absoluteMin) return results;

  if (element.width < nacto.recommendedMin) {
    results.push({
      valid: false,
      severity: 'warning',
      elementId: element.id,
      constraint: 'nacto',
      message: `${element.type} width ${element.width} ft is below NACTO recommended minimum of ${nacto.recommendedMin} ft`,
      citation: nacto.source,
      currentValue: element.width,
      requiredValue: nacto.recommendedMin,
    });
  } else if (element.width < nacto.recommended) {
    results.push({
      valid: true,
      severity: 'info',
      elementId: element.id,
      constraint: 'nacto',
      message: `${element.type} width ${element.width} ft is below NACTO recommended ${nacto.recommended} ft — could be improved`,
      citation: nacto.source,
      currentValue: element.width,
      requiredValue: nacto.recommended,
    });
  }

  return results;
}

/**
 * Check dimensional absolute-min and absolute-max constraints (error).
 */
function checkDimensional(
  element: CrossSectionElement,
  nacto: NactoElementConstraint,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (element.width < nacto.absoluteMin) {
    results.push({
      valid: false,
      severity: 'error',
      elementId: element.id,
      constraint: 'dimensional',
      message: `${element.type} width ${element.width} ft is below absolute minimum of ${nacto.absoluteMin} ft`,
      citation: nacto.source,
      currentValue: element.width,
      requiredValue: nacto.absoluteMin,
    });
  }

  if (element.width > nacto.absoluteMax) {
    results.push({
      valid: false,
      severity: 'error',
      elementId: element.id,
      constraint: 'dimensional',
      message: `${element.type} width ${element.width} ft exceeds absolute maximum of ${nacto.absoluteMax} ft`,
      citation: nacto.source,
      currentValue: element.width,
      requiredValue: nacto.absoluteMax,
    });
  }

  return results;
}

/**
 * Check that element widths sum to the declared totalROWWidth.
 */
function checkTotalWidth(street: StreetSegment): ValidationResult[] {
  const sum = street.elements.reduce((acc, el) => acc + el.width, 0);
  // Use a small epsilon for floating-point comparison
  if (Math.abs(sum - street.totalROWWidth) > 0.01) {
    return [
      {
        valid: false,
        severity: 'error',
        elementId: '__street__',
        constraint: 'dimensional',
        message: `Total element widths (${sum} ft) do not match declared ROW width (${street.totalROWWidth} ft)`,
        citation: 'Cross-section geometry',
        currentValue: sum,
        requiredValue: street.totalROWWidth,
      },
    ];
  }
  return [];
}

/**
 * Check that the sum of curb-to-curb element widths matches the declared
 * curbToCurbWidth.
 */
function checkCurbToCurb(street: StreetSegment): ValidationResult[] {
  const curbToCurbSum = street.elements
    .filter((el) => CURB_TO_CURB_TYPES.has(el.type))
    .reduce((acc, el) => acc + el.width, 0);

  if (Math.abs(curbToCurbSum - street.curbToCurbWidth) > 0.01) {
    return [
      {
        valid: false,
        severity: 'warning',
        elementId: '__street__',
        constraint: 'dimensional',
        message: `Computed curb-to-curb width (${curbToCurbSum} ft) does not match declared curb-to-curb width (${street.curbToCurbWidth} ft)`,
        citation: 'Cross-section geometry',
        currentValue: curbToCurbSum,
        requiredValue: street.curbToCurbWidth,
      },
    ];
  }
  return [];
}
