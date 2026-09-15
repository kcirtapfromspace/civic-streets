import type {
  CrossSectionElement,
  ElementType,
  StreetSegment,
  ValidationResult,
} from '@/lib/types';
import { DEFAULT_CONSTRAINTS, ELEMENT_COLORS } from '@/lib/constants';
export function element(
  id = 'sidewalk',
  type: ElementType = 'sidewalk',
  width = 6,
): CrossSectionElement {
  return {
    id,
    type,
    width,
    side: 'left',
    locked: false,
    label: ELEMENT_COLORS[type].label,
    constraints: { ...DEFAULT_CONSTRAINTS[type] },
  };
}
export function street(elements = [element(), element('lane', 'travel-lane', 10)]): StreetSegment {
  return {
    id: 'broadway',
    name: 'Broadway',
    totalROWWidth: 60,
    curbToCurbWidth: 10,
    direction: 'two-way',
    functionalClass: 'local',
    elements,
    metadata: { createdAt: '2026-09-14', updatedAt: '2026-09-14' },
  };
}
export function validation(
  elementId = 'sidewalk',
  severity: ValidationResult['severity'] = 'error',
  constraint: ValidationResult['constraint'] = 'prowag',
): ValidationResult {
  return {
    elementId,
    severity,
    constraint,
    valid: false,
    currentValue: 4,
    requiredValue: 6,
    message: `${severity} for ${elementId}`,
    citation: 'Design standard section 1',
  };
}
