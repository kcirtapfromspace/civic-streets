import { describe, it, expect, beforeAll } from 'vitest';
import { loadStandards, validateStreet } from '../validator';
import type { StandardsData } from '../validator';
import type {
  StreetSegment,
  CrossSectionElement,
  DimensionalConstraint,
  ElementType,
} from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALL_ELEMENT_TYPES: ElementType[] = [
  'sidewalk',
  'planting-strip',
  'furniture-zone',
  'bike-lane',
  'bike-lane-protected',
  'buffer',
  'parking-lane',
  'travel-lane',
  'turn-lane',
  'transit-lane',
  'median',
  'curb',
];

function makeConstraint(overrides: Partial<DimensionalConstraint> = {}): DimensionalConstraint {
  return {
    absoluteMin: 4,
    recommendedMin: 5,
    recommended: 6,
    absoluteMax: 20,
    source: 'test',
    prowagRequired: false,
    ...overrides,
  };
}

function makeElement(
  id: string,
  type: ElementType,
  width: number,
  overrides: Partial<CrossSectionElement> = {},
): CrossSectionElement {
  return {
    id,
    type,
    side: 'left' as const,
    width,
    constraints: makeConstraint(),
    locked: false,
    ...overrides,
  };
}

function makeStreet(overrides: Partial<StreetSegment> = {}): StreetSegment {
  return {
    id: 'test-street',
    name: 'Test Street',
    totalROWWidth: 60,
    curbToCurbWidth: 36,
    direction: 'two-way',
    functionalClass: 'collector',
    elements: [],
    metadata: { createdAt: '2025-01-01', updatedAt: '2025-01-01' },
    ...overrides,
  };
}

/**
 * Build a valid 60 ft 4-lane street:
 *   left sidewalk (6) + left curb (0.5) + left parking (8) +
 *   travel-lane (10) + travel-lane (10) + right parking (8) +
 *   right curb (0.5) + right sidewalk (6) +
 *   left planting-strip (5.5) + right planting-strip (5.5)
 *   = 60 ft
 *   curb-to-curb = parking(8) + travel(10) + travel(10) + parking(8) = 36
 */
function makeValid60FtStreet(_standards: StandardsData): StreetSegment {
  return makeStreet({
    totalROWWidth: 60,
    curbToCurbWidth: 36,
    elements: [
      makeElement('sw-l', 'sidewalk', 6, { side: 'left' }),
      makeElement('ps-l', 'planting-strip', 5.5, { side: 'left' }),
      makeElement('curb-l', 'curb', 0.5, { side: 'left' }),
      makeElement('park-l', 'parking-lane', 8, { side: 'left' }),
      makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
      makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
      makeElement('park-r', 'parking-lane', 8, { side: 'right' }),
      makeElement('curb-r', 'curb', 0.5, { side: 'right' }),
      makeElement('ps-r', 'planting-strip', 5.5, { side: 'right' }),
      makeElement('sw-r', 'sidewalk', 6, { side: 'right' }),
    ],
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('loadStandards', () => {
  it('loads NACTO and PROWAG data', () => {
    const standards = loadStandards();
    expect(standards.nacto).toBeDefined();
    expect(standards.prowag).toBeDefined();
    expect(standards.nacto.version).toMatch(/NACTO/);
    expect(standards.prowag.version).toMatch(/PROWAG/);
  });

  it('contains constraint data for all 12 element types', () => {
    const standards = loadStandards();
    for (const type of ALL_ELEMENT_TYPES) {
      expect(standards.nacto.elements[type]).toBeDefined();
      expect(standards.nacto.elements[type].absoluteMin).toBeGreaterThan(0);
      expect(standards.nacto.elements[type].source).toBeTruthy();
    }
  });

  it('PROWAG requirements have citations', () => {
    const standards = loadStandards();
    for (const [, req] of Object.entries(standards.prowag.requirements)) {
      expect(req.citation).toBeTruthy();
      expect(req.citation).toMatch(/PROWAG/);
    }
  });
});

describe('validateStreet', () => {
  let standards: StandardsData;

  beforeAll(() => {
    standards = loadStandards();
  });

  it('a valid 60 ft street passes validation with no errors', () => {
    const street = makeValid60FtStreet(standards);
    const results = validateStreet(street, standards);

    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('a street with 3 ft sidewalk fails PROWAG (error)', () => {
    const street = makeStreet({
      totalROWWidth: 57,
      curbToCurbWidth: 36,
      elements: [
        makeElement('sw-l', 'sidewalk', 3, { side: 'left' }),
        makeElement('ps-l', 'planting-strip', 5.5, { side: 'left' }),
        makeElement('curb-l', 'curb', 0.5, { side: 'left' }),
        makeElement('park-l', 'parking-lane', 8, { side: 'left' }),
        makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
        makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
        makeElement('park-r', 'parking-lane', 8, { side: 'right' }),
        makeElement('curb-r', 'curb', 0.5, { side: 'right' }),
        makeElement('ps-r', 'planting-strip', 5.5, { side: 'right' }),
        makeElement('sw-r', 'sidewalk', 6, { side: 'right' }),
      ],
    });

    const results = validateStreet(street, standards);
    const prowagErrors = results.filter(
      (r) => r.constraint === 'prowag' && r.severity === 'error' && r.elementId === 'sw-l',
    );
    expect(prowagErrors.length).toBeGreaterThan(0);
    expect(prowagErrors[0].citation).toMatch(/PROWAG/);
  });

  it('a street with 4.5 ft sidewalk passes PROWAG but warns NACTO', () => {
    const street = makeStreet({
      totalROWWidth: 58.5,
      curbToCurbWidth: 36,
      elements: [
        makeElement('sw-l', 'sidewalk', 4.5, { side: 'left' }),
        makeElement('ps-l', 'planting-strip', 5.5, { side: 'left' }),
        makeElement('curb-l', 'curb', 0.5, { side: 'left' }),
        makeElement('park-l', 'parking-lane', 8, { side: 'left' }),
        makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
        makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
        makeElement('park-r', 'parking-lane', 8, { side: 'right' }),
        makeElement('curb-r', 'curb', 0.5, { side: 'right' }),
        makeElement('ps-r', 'planting-strip', 5.5, { side: 'right' }),
        makeElement('sw-r', 'sidewalk', 6, { side: 'right' }),
      ],
    });

    const results = validateStreet(street, standards);

    // No PROWAG errors for sw-l (4.5 >= 4)
    const prowagErrors = results.filter(
      (r) => r.constraint === 'prowag' && r.severity === 'error' && r.elementId === 'sw-l',
    );
    expect(prowagErrors).toHaveLength(0);

    // NACTO warning for sw-l (4.5 < 5 recommendedMin)
    const nactoWarnings = results.filter(
      (r) => r.constraint === 'nacto' && r.severity === 'warning' && r.elementId === 'sw-l',
    );
    expect(nactoWarnings.length).toBeGreaterThan(0);
  });

  it('total width mismatch produces error', () => {
    const street = makeStreet({
      totalROWWidth: 100, // declared 100 but elements only sum to 60
      curbToCurbWidth: 36,
      elements: makeValid60FtStreet(standards).elements,
    });

    const results = validateStreet(street, standards);
    const totalErrors = results.filter(
      (r) =>
        r.severity === 'error' &&
        r.constraint === 'dimensional' &&
        r.elementId === '__street__',
    );
    expect(totalErrors.length).toBeGreaterThan(0);
    expect(totalErrors[0].message).toMatch(/total/i);
  });

  it('curb-to-curb width mismatch produces warning', () => {
    const street = makeValid60FtStreet(standards);
    street.curbToCurbWidth = 50; // wrong value

    const results = validateStreet(street, standards);
    const c2cWarnings = results.filter(
      (r) =>
        r.severity === 'warning' &&
        r.elementId === '__street__' &&
        r.message.toLowerCase().includes('curb-to-curb'),
    );
    expect(c2cWarnings.length).toBeGreaterThan(0);
  });

  it('element exceeding absoluteMax produces dimensional error', () => {
    const street = makeStreet({
      totalROWWidth: 85,
      curbToCurbWidth: 36,
      elements: [
        makeElement('sw-l', 'sidewalk', 25, { side: 'left' }), // max is 20
        makeElement('ps-l', 'planting-strip', 5.5, { side: 'left' }),
        makeElement('curb-l', 'curb', 0.5, { side: 'left' }),
        makeElement('park-l', 'parking-lane', 8, { side: 'left' }),
        makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
        makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
        makeElement('park-r', 'parking-lane', 8, { side: 'right' }),
        makeElement('curb-r', 'curb', 0.5, { side: 'right' }),
        makeElement('ps-r', 'planting-strip', 5.5, { side: 'right' }),
        makeElement('sw-r', 'sidewalk', 11.5, { side: 'right' }),
      ],
    });

    const results = validateStreet(street, standards);
    const dimErrors = results.filter(
      (r) =>
        r.severity === 'error' &&
        r.constraint === 'dimensional' &&
        r.elementId === 'sw-l' &&
        r.message.includes('exceeds absolute maximum'),
    );
    expect(dimErrors.length).toBeGreaterThan(0);
  });

  it('every ValidationResult has a non-empty citation', () => {
    // Use a purposely bad street to get many results
    const street = makeStreet({
      totalROWWidth: 100,
      curbToCurbWidth: 99,
      elements: [
        makeElement('sw-l', 'sidewalk', 2, { side: 'left' }),
        makeElement('tl-1', 'travel-lane', 8, { side: 'center' }),
      ],
    });

    const results = validateStreet(street, standards);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.citation).toBeTruthy();
    }
  });
});
