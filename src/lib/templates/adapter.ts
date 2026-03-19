// WS3: Template adapter — fits templates to target ROW width
// Uses PROWAG-first allocation: PROWAG minimums are sacrosanct, then distributes
// remaining width proportionally among flexible elements.

import type {
  StreetSegment,
  TemplateDefinition,
  CrossSectionElement,
  ElementType,
} from '@/lib/types';

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

/**
 * Generate a unique ID for an element.
 * Uses crypto.randomUUID when available, falls back to a counter-based ID.
 */
let idCounter = 0;
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `el-${Date.now()}-${idCounter}`;
}

/**
 * Adapt a template to a target ROW width.
 *
 * Algorithm:
 * 1. Start with template's element widths (designed for template's first ROW width).
 * 2. Calculate width difference between template's designed ROW and target ROW.
 * 3. PROWAG-first: Ensure all prowagRequired elements meet their absoluteMin.
 * 4. Distribute remaining width difference proportionally among non-locked, non-PROWAG elements.
 * 5. Clamp all elements to their [absoluteMin, absoluteMax] range.
 * 6. If target is too narrow for PROWAG minimums, still meet PROWAG and compress others to absoluteMin.
 * 7. Return a complete StreetSegment with unique element IDs and metadata.
 */
export function adaptTemplate(
  template: TemplateDefinition,
  targetROWWidth: number,
): StreetSegment {
  // Start with a copy of template element widths
  const elements: Array<Omit<CrossSectionElement, 'id'> & { width: number }> =
    template.elements.map((el) => ({ ...el }));

  const designedROW = template.elements.reduce((acc, el) => acc + el.width, 0);
  let widthDifference = targetROWWidth - designedROW;

  // Phase 1: Ensure PROWAG minimums are met
  for (const el of elements) {
    if (el.constraints.prowagRequired && el.width < el.constraints.absoluteMin) {
      const needed = el.constraints.absoluteMin - el.width;
      el.width = el.constraints.absoluteMin;
      widthDifference -= needed;
    }
  }

  // Phase 2: Distribute remaining difference among flexible (non-locked) elements
  if (Math.abs(widthDifference) > 0.001) {
    // Identify adjustable elements: not locked
    // PROWAG elements can grow but shouldn't shrink below their absoluteMin
    const adjustable = elements.filter((el) => !el.locked);

    if (adjustable.length > 0) {
      if (widthDifference > 0) {
        // Expanding: distribute extra width proportionally by current width
        distributeWidth(adjustable, widthDifference);
      } else {
        // Shrinking: compress non-PROWAG-required elements first
        const nonProwag = adjustable.filter((el) => !el.constraints.prowagRequired);
        const prowag = adjustable.filter((el) => el.constraints.prowagRequired);

        let remaining = Math.abs(widthDifference);

        // First pass: shrink non-PROWAG elements proportionally
        if (nonProwag.length > 0) {
          const shrinkable = computeShrinkable(nonProwag);
          const shrinkAmount = Math.min(remaining, shrinkable);
          if (shrinkAmount > 0.001) {
            distributeWidth(nonProwag, -shrinkAmount);
            remaining -= shrinkAmount;
          }
        }

        // Second pass: if still need to shrink, compress PROWAG elements to absoluteMin
        if (remaining > 0.001 && prowag.length > 0) {
          const shrinkable = computeShrinkable(prowag);
          const shrinkAmount = Math.min(remaining, shrinkable);
          if (shrinkAmount > 0.001) {
            distributeWidth(prowag, -shrinkAmount);
            remaining -= shrinkAmount;
          }
        }

        // Third pass: if STILL need to shrink (infeasible), compress all non-locked to absoluteMin
        if (remaining > 0.001) {
          for (const el of adjustable) {
            if (el.width > el.constraints.absoluteMin) {
              const canShrink = el.width - el.constraints.absoluteMin;
              const shrink = Math.min(canShrink, remaining);
              el.width -= shrink;
              remaining -= shrink;
              if (remaining <= 0.001) break;
            }
          }
        }
      }
    }
  }

  // Phase 3: Clamp all elements and round to reasonable precision (0.1 ft)
  for (const el of elements) {
    el.width = Math.max(el.constraints.absoluteMin, el.width);
    el.width = Math.min(el.constraints.absoluteMax, el.width);
    el.width = Math.round(el.width * 10) / 10;
  }

  // Phase 4: Fix any residual floating-point error so widths sum exactly to target
  // Only apply small corrections; large residuals mean the target is infeasible.
  const currentSum = elements.reduce((acc, el) => acc + el.width, 0);
  let residual = Math.round((targetROWWidth - currentSum) * 10) / 10;
  if (Math.abs(residual) > 0.001) {
    // Sort adjustable elements by how much room they have to absorb the residual
    const adjustable = elements
      .filter((el) => !el.locked)
      .sort((a, b) => b.width - a.width);

    for (const el of adjustable) {
      if (Math.abs(residual) <= 0.001) break;

      const min = el.constraints.absoluteMin;
      const max = el.constraints.absoluteMax;

      if (residual > 0) {
        // Need to add width
        const room = max - el.width;
        const add = Math.min(residual, Math.max(0, room));
        el.width = Math.round((el.width + add) * 10) / 10;
        residual = Math.round((residual - add) * 10) / 10;
      } else {
        // Need to remove width
        const room = el.width - min;
        const remove = Math.min(Math.abs(residual), Math.max(0, room));
        el.width = Math.round((el.width - remove) * 10) / 10;
        residual = Math.round((residual + remove) * 10) / 10;
      }
    }
  }

  // Build the CrossSectionElement array with unique IDs
  const crossSectionElements: CrossSectionElement[] = elements.map((el) => ({
    id: generateId(),
    type: el.type,
    side: el.side,
    width: el.width,
    constraints: { ...el.constraints },
    locked: el.locked,
    ...(el.label ? { label: el.label } : {}),
    ...(el.variant ? { variant: el.variant } : {}),
  }));

  // Calculate curb-to-curb width
  const curbToCurbWidth = crossSectionElements
    .filter((el) => CURB_TO_CURB_TYPES.has(el.type))
    .reduce((acc, el) => acc + el.width, 0);

  const now = new Date().toISOString();

  return {
    id: generateId(),
    name: template.name,
    totalROWWidth: targetROWWidth,
    curbToCurbWidth: Math.round(curbToCurbWidth * 10) / 10,
    direction: 'two-way',
    functionalClass: template.applicableFunctionalClasses[0],
    elements: crossSectionElements,
    metadata: {
      createdAt: now,
      updatedAt: now,
      templateId: template.id,
    },
  };
}

/**
 * Distribute a width delta proportionally among elements based on their current widths.
 * When shrinking, respects absoluteMin. When expanding, respects absoluteMax.
 * Mutates elements in place.
 */
function distributeWidth(
  elements: Array<{ width: number; constraints: { absoluteMin: number; absoluteMax: number } }>,
  delta: number,
): void {
  const isExpanding = delta > 0;
  let remaining = Math.abs(delta);
  let iterations = 0;
  const maxIterations = 20;

  while (remaining > 0.001 && iterations < maxIterations) {
    iterations++;

    // Calculate how much width each element can absorb
    const capacities = elements.map((el) => {
      if (isExpanding) {
        return Math.max(0, el.constraints.absoluteMax - el.width);
      } else {
        return Math.max(0, el.width - el.constraints.absoluteMin);
      }
    });

    const totalCapacity = capacities.reduce((a, b) => a + b, 0);
    if (totalCapacity <= 0.001) break;

    const toDistribute = Math.min(remaining, totalCapacity);

    // Proportional weights based on current width (elements with more width get more change)
    const totalWeight = elements.reduce((acc, el) => acc + el.width, 0);

    for (let i = 0; i < elements.length; i++) {
      if (capacities[i] <= 0.001) continue;

      const weight = totalWeight > 0 ? elements[i].width / totalWeight : 1 / elements.length;
      let share = toDistribute * weight;
      share = Math.min(share, capacities[i]);

      if (isExpanding) {
        elements[i].width += share;
      } else {
        elements[i].width -= share;
      }
      remaining -= share;
    }
  }
}

/**
 * Calculate the total shrinkable width of a set of elements
 * (how much they can shrink before hitting their absoluteMin).
 */
function computeShrinkable(
  elements: Array<{ width: number; constraints: { absoluteMin: number } }>,
): number {
  return elements.reduce((acc, el) => acc + Math.max(0, el.width - el.constraints.absoluteMin), 0);
}
