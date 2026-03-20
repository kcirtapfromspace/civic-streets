import { describe, it, expect, beforeAll } from 'vitest';
import { solveConstraints } from '../constraint-solver';
import { solveConstraintsDetailed } from '../constraint-solver';
import { loadStandards } from '../validator';
import type { StandardsData } from '../validator';
import type {
  CrossSectionElement,
  DimensionalConstraint,
  ElementType,
} from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('solveConstraints', () => {
  let standards: StandardsData;

  beforeAll(() => {
    standards = loadStandards();
  });

  it('allocates PROWAG minimums first for sidewalks', () => {
    const elements: CrossSectionElement[] = [
      makeElement('sw-l', 'sidewalk', 8, { side: 'left' }),
      makeElement('tl-1', 'travel-lane', 12, { side: 'center' }),
      makeElement('tl-2', 'travel-lane', 12, { side: 'center' }),
      makeElement('sw-r', 'sidewalk', 8, { side: 'right' }),
    ];

    const result = solveConstraints(elements, 40, standards);

    // Sidewalks should be at PROWAG absoluteMin (4 ft) since solver starts there
    // then remaining 32 ft gets distributed among travel lanes and sidewalks get
    // their share back via proportional allocation.
    // Key assertion: sidewalk width must be >= 4 (PROWAG min)
    const leftSidewalk = result.find((el) => el.id === 'sw-l')!;
    const rightSidewalk = result.find((el) => el.id === 'sw-r')!;
    expect(leftSidewalk.width).toBeGreaterThanOrEqual(4);
    expect(rightSidewalk.width).toBeGreaterThanOrEqual(4);

    // Total should equal ROW width
    const total = result.reduce((s, el) => s + el.width, 0);
    expect(total).toBeCloseTo(40, 1);
  });

  it('respects user-locked elements', () => {
    const elements: CrossSectionElement[] = [
      makeElement('sw-l', 'sidewalk', 6, { side: 'left' }),
      makeElement('tl-1', 'travel-lane', 11, { side: 'center', locked: true }),
      makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
      makeElement('sw-r', 'sidewalk', 6, { side: 'right' }),
    ];

    const result = solveConstraints(elements, 33, standards);
    const locked = result.find((el) => el.id === 'tl-1')!;
    expect(locked.width).toBe(11); // locked stays at 11
  });

  it('handles infeasible 30 ft ROW correctly', () => {
    // A 30 ft ROW with many elements — impossible to fit at minimums
    const elements: CrossSectionElement[] = [
      makeElement('sw-l', 'sidewalk', 6, { side: 'left' }),
      makeElement('ps-l', 'planting-strip', 5, { side: 'left' }),
      makeElement('curb-l', 'curb', 0.5, { side: 'left' }),
      makeElement('park-l', 'parking-lane', 8, { side: 'left' }),
      makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
      makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
      makeElement('park-r', 'parking-lane', 8, { side: 'right' }),
      makeElement('curb-r', 'curb', 0.5, { side: 'right' }),
      makeElement('ps-r', 'planting-strip', 5, { side: 'right' }),
      makeElement('sw-r', 'sidewalk', 6, { side: 'right' }),
    ];

    const detailed = solveConstraintsDetailed(elements, 30, standards);

    // This should be infeasible — too many elements for 30 ft
    expect(detailed.feasible).toBe(false);
    expect(detailed.overageWidth).toBeGreaterThan(0);

    // Even infeasible, sidewalks should be at PROWAG min (4 ft)
    const swL = detailed.elements.find((el) => el.id === 'sw-l')!;
    const swR = detailed.elements.find((el) => el.id === 'sw-r')!;
    expect(swL.width).toBe(4);
    expect(swR.width).toBe(4);
  });

  it('distributes remaining width proportionally among unlocked elements', () => {
    const elements: CrossSectionElement[] = [
      makeElement('sw-l', 'sidewalk', 6, { side: 'left' }),
      makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
      makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
      makeElement('sw-r', 'sidewalk', 6, { side: 'right' }),
    ];

    // 60 ft gives plenty of room
    const result = solveConstraints(elements, 60, standards);
    const total = result.reduce((s, el) => s + el.width, 0);
    expect(total).toBeCloseTo(60, 1);

    // All widths should be >= their absoluteMin
    for (const el of result) {
      const nacto = standards.nacto.elements[el.type];
      expect(el.width).toBeGreaterThanOrEqual(nacto.absoluteMin);
    }
  });

  it('clamps elements at absoluteMax when surplus is large', () => {
    // Only two small elements for a huge ROW
    const elements: CrossSectionElement[] = [
      makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
      makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
    ];

    const result = solveConstraints(elements, 100, standards);
    // Travel lane absoluteMax is 12; two lanes = 24, but ROW is 100
    // Still, each travel lane should be capped at 12
    for (const el of result) {
      expect(el.width).toBeLessThanOrEqual(
        standards.nacto.elements[el.type].absoluteMax,
      );
    }
  });

  it('does not mutate the original elements array', () => {
    const elements: CrossSectionElement[] = [
      makeElement('sw-l', 'sidewalk', 6, { side: 'left' }),
      makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
    ];
    const originalWidths = elements.map((el) => el.width);

    solveConstraints(elements, 20, standards);

    elements.forEach((el, i) => {
      expect(el.width).toBe(originalWidths[i]);
    });
  });

  it('feasible street sums to totalROWWidth', () => {
    const elements: CrossSectionElement[] = [
      makeElement('sw-l', 'sidewalk', 6, { side: 'left' }),
      makeElement('curb-l', 'curb', 0.5, { side: 'left' }),
      makeElement('tl-1', 'travel-lane', 10, { side: 'center' }),
      makeElement('tl-2', 'travel-lane', 10, { side: 'center' }),
      makeElement('curb-r', 'curb', 0.5, { side: 'right' }),
      makeElement('sw-r', 'sidewalk', 6, { side: 'right' }),
    ];

    const detailed = solveConstraintsDetailed(elements, 40, standards);
    expect(detailed.feasible).toBe(true);
    const total = detailed.elements.reduce((s, el) => s + el.width, 0);
    expect(total).toBeCloseTo(40, 1);
  });
});
