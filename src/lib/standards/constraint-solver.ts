// WS1: PROWAG-first constraint solver
// Allocates pedestrian space first, then distributes remaining width
import type { CrossSectionElement } from '@/lib/types';
import type { StandardsData, NactoElementConstraint } from './validator';

/** Result metadata attached alongside the returned elements */
export interface SolveResult {
  elements: CrossSectionElement[];
  feasible: boolean;
  /** If infeasible, how many feet over budget the PROWAG + locked allocation is */
  overageWidth: number;
}

/**
 * PROWAG-first constraint solver.
 *
 * Algorithm:
 * 1. **First pass** — Lock all PROWAG-required elements at their absoluteMin
 *    (sidewalks, curbs, or any element flagged `prowagRequired`).
 * 2. **Second pass** — Lock user-locked elements at their current width.
 * 3. **Feasibility check** — If PROWAG + locked + non-PROWAG absoluteMins
 *    exceed ROW width, return elements at minimums and flag infeasible.
 * 4. **Third pass** — Distribute remaining width proportionally among all
 *    unlocked elements (PROWAG elements participate but cannot drop below
 *    their absoluteMin).
 *
 * If the total after PROWAG + user-locked allocation exceeds the ROW width,
 * the solver returns elements at PROWAG minimums with `feasible: false`.
 */
export function solveConstraints(
  elements: CrossSectionElement[],
  totalROWWidth: number,
  standards: StandardsData,
): CrossSectionElement[] {
  const result = solveConstraintsDetailed(elements, totalROWWidth, standards);
  return result.elements;
}

/**
 * Same algorithm as `solveConstraints` but also returns feasibility metadata.
 */
export function solveConstraintsDetailed(
  elements: CrossSectionElement[],
  totalROWWidth: number,
  standards: StandardsData,
): SolveResult {
  // Deep-clone so we never mutate the caller's array
  const out: CrossSectionElement[] = elements.map((el) => ({ ...el }));

  // Helper: look up NACTO constraint for an element type
  const nacto = (type: string): NactoElementConstraint | undefined =>
    standards.nacto.elements[type];

  // ── Pass 1: PROWAG-required elements → absoluteMin ──────────────────────
  const prowagIds = new Set<string>();
  for (const el of out) {
    const constraint = nacto(el.type);
    if (constraint?.prowagRequired) {
      el.width = constraint.absoluteMin;
      prowagIds.add(el.id);
    }
  }

  // ── Pass 2: User-locked elements stay at their current width ────────────
  const lockedIds = new Set<string>();
  for (const el of out) {
    if (el.locked && !prowagIds.has(el.id)) {
      lockedIds.add(el.id);
      // Width is already el.width — no change needed
    }
  }

  // ── Feasibility check ─────────────────────────────────────────────────────
  // Fixed elements = PROWAG at absoluteMin + user-locked at their width
  const lockedWidth = out
    .filter((el) => lockedIds.has(el.id))
    .reduce((sum, el) => sum + el.width, 0);

  const prowagWidth = out
    .filter((el) => prowagIds.has(el.id))
    .reduce((sum, el) => sum + el.width, 0);

  // Unlocked non-PROWAG elements
  const flexOnlyElements = out.filter(
    (el) => !prowagIds.has(el.id) && !lockedIds.has(el.id),
  );

  // Minimum width needed for non-PROWAG, non-locked elements
  const flexMinSum = flexOnlyElements.reduce((sum, el) => {
    const c = nacto(el.type);
    return sum + (c ? c.absoluteMin : el.width);
  }, 0);

  const totalMinRequired = prowagWidth + lockedWidth + flexMinSum;

  if (totalMinRequired > totalROWWidth + 0.01) {
    // Infeasible: even at absoluteMins we exceed the ROW budget.
    // Set all flex elements to their absoluteMin and report overage.
    for (const el of flexOnlyElements) {
      const c = nacto(el.type);
      el.width = c ? c.absoluteMin : el.width;
    }
    const actualTotal = out.reduce((s, el) => s + el.width, 0);
    return {
      elements: out,
      feasible: false,
      overageWidth: parseFloat((actualTotal - totalROWWidth).toFixed(4)),
    };
  }

  // ── Pass 3: Distribute remaining width ─────────────────────────────────
  // All unlocked elements participate (including PROWAG elements).
  const allFlexElements = out.filter((el) => !lockedIds.has(el.id));

  if (allFlexElements.length === 0) {
    const total = out.reduce((s, el) => s + el.width, 0);
    return {
      elements: out,
      feasible: Math.abs(total - totalROWWidth) < 0.01,
      overageWidth: parseFloat(Math.max(0, total - totalROWWidth).toFixed(4)),
    };
  }

  const budgetForFlex = totalROWWidth - lockedWidth;
  distributeWidth(allFlexElements, budgetForFlex, standards);

  return { elements: out, feasible: true, overageWidth: 0 };
}

// ── Distribution helper ──────────────────────────────────────────────────────

/**
 * Distribute `budget` feet among `elements` proportionally to their
 * absoluteMin weights, clamping to [absoluteMin, absoluteMax].
 * Iterates until all surplus is absorbed (handles clamping redistribution).
 */
function distributeWidth(
  elements: CrossSectionElement[],
  budget: number,
  standards: StandardsData,
): void {
  const nacto = (type: string): NactoElementConstraint | undefined =>
    standards.nacto.elements[type];

  // Start every flex element at its absoluteMin as a baseline
  for (const el of elements) {
    const c = nacto(el.type);
    el.width = c ? c.absoluteMin : el.width;
  }

  let surplus = budget - elements.reduce((s, el) => s + el.width, 0);

  // Track which elements are still adjustable (not yet clamped at max)
  const adjustable = new Set(elements.map((el) => el.id));

  // Iterative proportional allocation
  const MAX_ITERATIONS = 20;
  for (let iter = 0; iter < MAX_ITERATIONS && surplus > 0.01; iter++) {
    const adjustableEls = elements.filter((el) => adjustable.has(el.id));
    if (adjustableEls.length === 0) break;

    // Weight by current width so wider element types get proportionally more
    const totalWeight = adjustableEls.reduce((s, el) => s + el.width, 0);
    if (totalWeight < 0.01) {
      // All at zero — distribute evenly
      const share = surplus / adjustableEls.length;
      for (const el of adjustableEls) {
        el.width += share;
      }
      break;
    }

    let clampedThisRound = false;
    for (const el of adjustableEls) {
      const share = (el.width / totalWeight) * surplus;
      const c = nacto(el.type);
      const max = c ? c.absoluteMax : Infinity;
      const newWidth = el.width + share;

      if (newWidth > max) {
        el.width = max;
        adjustable.delete(el.id);
        clampedThisRound = true;
      } else {
        el.width = newWidth;
      }
    }

    // Recompute surplus after potential clamping
    surplus = budget - elements.reduce((s, el) => s + el.width, 0);

    if (!clampedThisRound) break;
  }

  // Round widths to 2 decimal places to avoid floating-point dust
  for (const el of elements) {
    el.width = parseFloat(el.width.toFixed(2));
  }
}
