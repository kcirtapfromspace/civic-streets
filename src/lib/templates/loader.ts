// WS3: Template loader — loads template JSON files from data/templates/
import type { TemplateDefinition, TemplateCategory, FunctionalClass } from '@/lib/types';

// Static imports of all template JSON files
import roadDiet4to3 from '../../../data/templates/road-diet-4to3.json';
import roadDietWithParking from '../../../data/templates/road-diet-with-parking.json';
import protectedBikeLaneOneWay from '../../../data/templates/protected-bike-lane-one-way.json';
import protectedBikeLaneTwoWay from '../../../data/templates/protected-bike-lane-two-way.json';
import protectedBikeLaneParking from '../../../data/templates/protected-bike-lane-parking.json';
import transitPriorityDedicated from '../../../data/templates/transit-priority-dedicated.json';
import transitPriorityBrt from '../../../data/templates/transit-priority-brt.json';
import completeStreetLocal from '../../../data/templates/complete-street-local.json';
import completeStreetCollector from '../../../data/templates/complete-street-collector.json';
import completeStreetArterial from '../../../data/templates/complete-street-arterial.json';
import sharedStreetResidential from '../../../data/templates/shared-street-residential.json';
import sharedStreetCommercial from '../../../data/templates/shared-street-commercial.json';

// All templates as a typed array. Each JSON matches TemplateDefinition shape.
const ALL_TEMPLATES: TemplateDefinition[] = [
  roadDiet4to3,
  roadDietWithParking,
  protectedBikeLaneOneWay,
  protectedBikeLaneTwoWay,
  protectedBikeLaneParking,
  transitPriorityDedicated,
  transitPriorityBrt,
  completeStreetLocal,
  completeStreetCollector,
  completeStreetArterial,
  sharedStreetResidential,
  sharedStreetCommercial,
] as TemplateDefinition[];

/**
 * Load all template definitions from the data/templates/ directory.
 * Validates that each template's elements sum to its first applicableROWWidth.
 */
export function loadTemplates(): TemplateDefinition[] {
  // Validate structure on load
  for (const t of ALL_TEMPLATES) {
    const sum = t.elements.reduce((acc, el) => acc + el.width, 0);
    const designedROW = t.applicableROWWidths[0];
    if (Math.abs(sum - designedROW) > 0.01) {
      console.warn(
        `Template "${t.id}" element widths sum to ${sum} ft but designed ROW is ${designedROW} ft`,
      );
    }
  }
  return ALL_TEMPLATES;
}

/**
 * Get a single template by its unique ID.
 */
export function getTemplateById(id: string): TemplateDefinition | null {
  return ALL_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Filter options for the template gallery.
 */
export interface FilterOptions {
  category?: TemplateCategory;
  rowWidth?: number;
  functionalClass?: FunctionalClass;
  tags?: string[];
}

/**
 * Filter templates by category, ROW width, functional class, and/or tags.
 * All provided criteria must match (logical AND).
 * For tags, at least one of the provided tags must be present in the template (logical OR within tags).
 */
export function filterTemplates(options: FilterOptions): TemplateDefinition[] {
  return ALL_TEMPLATES.filter((t) => {
    if (options.category && t.category !== options.category) return false;

    if (options.rowWidth && !t.applicableROWWidths.includes(options.rowWidth)) return false;

    if (
      options.functionalClass &&
      !t.applicableFunctionalClasses.includes(options.functionalClass)
    )
      return false;

    if (options.tags && options.tags.length > 0) {
      const hasMatchingTag = options.tags.some((tag) => t.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    return true;
  });
}
