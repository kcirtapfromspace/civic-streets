import type { StreetSegment, ValidationResult, ValidationSeverity } from '@/lib/types';
import { ELEMENT_COLORS } from '@/lib/constants';

/**
 * Generates a descriptive alt-text string for a street cross-section SVG.
 * Used as the aria-label on the root SVG and readable by screen readers.
 *
 * Example output:
 * "Cross-section of Main Street, 60 feet wide, two-way local street.
 *  From left to right: 6-foot sidewalk, 5-foot planting strip,
 *  8-foot parking lane, 10-foot travel lane, 10-foot travel lane,
 *  5-foot planting strip, 6-foot sidewalk. 2 validation warnings."
 */
export function generateAltText(
  street: StreetSegment,
  validationResults?: ValidationResult[],
): string {
  const parts: string[] = [];

  // Header: street name, total width, direction, functional class
  parts.push(
    `Cross-section of ${street.name}, ${street.totalROWWidth} feet wide, ${street.direction} ${street.functionalClass.replace('-', ' ')} street.`,
  );

  // Element list, left to right
  if (street.elements.length > 0) {
    const elementDescriptions = street.elements.map((el) => {
      const label = el.label ?? ELEMENT_COLORS[el.type].label;
      return `${el.width}-foot ${label.toLowerCase()}`;
    });
    parts.push(`From left to right: ${elementDescriptions.join(', ')}.`);
  } else {
    parts.push('No elements defined.');
  }

  // Validation summary
  if (validationResults && validationResults.length > 0) {
    const counts: Record<ValidationSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const v of validationResults) {
      counts[v.severity]++;
    }
    const summaryParts: string[] = [];
    if (counts.error > 0) summaryParts.push(`${counts.error} validation error${counts.error > 1 ? 's' : ''}`);
    if (counts.warning > 0) summaryParts.push(`${counts.warning} validation warning${counts.warning > 1 ? 's' : ''}`);
    if (counts.info > 0) summaryParts.push(`${counts.info} validation info note${counts.info > 1 ? 's' : ''}`);
    parts.push(summaryParts.join(', ') + '.');
  }

  return parts.join(' ');
}
