import { describe, it, expect } from 'vitest';
import { adaptTemplate } from '../adapter';
import { getTemplateById, loadTemplates } from '../loader';

// Load templates once for test use
const templates = loadTemplates();

describe('adaptTemplate', () => {
  describe('basic adaptation', () => {
    it('adapts a template to its designed ROW width (no change needed)', () => {
      const template = getTemplateById('road-diet-4to3')!;
      const designedROW = template.applicableROWWidths[0]; // 60
      const street = adaptTemplate(template, designedROW);

      expect(street.totalROWWidth).toBe(designedROW);
      const sum = street.elements.reduce((a, el) => a + el.width, 0);
      expect(Math.abs(sum - designedROW)).toBeLessThan(0.1);
    });

    it('returns a complete StreetSegment with all required fields', () => {
      const template = getTemplateById('road-diet-4to3')!;
      const street = adaptTemplate(template, 60);

      expect(street.id).toBeDefined();
      expect(street.name).toBe(template.name);
      expect(street.totalROWWidth).toBe(60);
      expect(street.curbToCurbWidth).toBeGreaterThan(0);
      expect(street.direction).toBe('two-way');
      expect(street.functionalClass).toBeDefined();
      expect(street.elements.length).toBe(template.elements.length);
      expect(street.metadata.createdAt).toBeDefined();
      expect(street.metadata.updatedAt).toBeDefined();
      expect(street.metadata.templateId).toBe(template.id);
    });
  });

  describe('element IDs', () => {
    it('generates unique IDs for each element', () => {
      const template = getTemplateById('complete-street-collector')!;
      const street = adaptTemplate(template, 66);

      const ids = street.elements.map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('generates a unique ID for the street segment itself', () => {
      const template = getTemplateById('road-diet-4to3')!;
      const street1 = adaptTemplate(template, 60);
      const street2 = adaptTemplate(template, 60);

      expect(street1.id).not.toBe(street2.id);
    });
  });

  describe('width summation', () => {
    it('element widths sum to target ROW width for expansion (66ft -> 80ft)', () => {
      const template = getTemplateById('road-diet-with-parking')!;
      const street = adaptTemplate(template, 80);

      const sum = street.elements.reduce((a, el) => a + el.width, 0);
      expect(Math.abs(sum - 80)).toBeLessThan(0.1);
    });

    it('element widths sum to target ROW width for compression (66ft -> 60ft)', () => {
      const template = getTemplateById('complete-street-collector')!;
      const street = adaptTemplate(template, 60);

      const sum = street.elements.reduce((a, el) => a + el.width, 0);
      expect(Math.abs(sum - 60)).toBeLessThan(0.1);
    });

    it('element widths sum to target for every template at every applicable ROW', () => {
      for (const template of templates) {
        for (const row of template.applicableROWWidths) {
          const street = adaptTemplate(template, row);
          const sum = street.elements.reduce((a, el) => a + el.width, 0);
          expect(Math.abs(sum - row)).toBeLessThan(0.2);
        }
      }
    });
  });

  describe('PROWAG compliance', () => {
    it('preserves PROWAG minimums when shrinking from 66ft to 60ft', () => {
      const template = getTemplateById('complete-street-collector')!;
      const street = adaptTemplate(template, 60);

      const prowagElements = street.elements.filter(
        (el) => el.constraints.prowagRequired,
      );

      for (const el of prowagElements) {
        expect(el.width).toBeGreaterThanOrEqual(el.constraints.absoluteMin);
      }
    });

    it('preserves PROWAG minimums across all templates when shrinking', () => {
      for (const template of templates) {
        // Shrink to 80% of designed ROW
        const designed = template.applicableROWWidths[0];
        const target = Math.round(designed * 0.8);
        const street = adaptTemplate(template, target);

        const prowagElements = street.elements.filter(
          (el) => el.constraints.prowagRequired,
        );
        for (const el of prowagElements) {
          expect(el.width).toBeGreaterThanOrEqual(
            el.constraints.absoluteMin - 0.1,
          );
        }
      }
    });

    it('PROWAG sidewalks never go below 4ft even at 30ft ROW', () => {
      const template = getTemplateById('road-diet-4to3')!;
      const street = adaptTemplate(template, 30);

      const sidewalks = street.elements.filter(
        (el) => el.type === 'sidewalk' && el.constraints.prowagRequired,
      );

      for (const sw of sidewalks) {
        expect(sw.width).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe('infeasible target', () => {
    it('handles a 30ft target for a template designed for 66ft gracefully', () => {
      const template = getTemplateById('complete-street-collector')!;
      // This should not throw
      const street = adaptTemplate(template, 30);

      expect(street).toBeDefined();
      expect(street.elements.length).toBe(template.elements.length);

      // All elements should be at or above their absolute minimums
      for (const el of street.elements) {
        expect(el.width).toBeGreaterThanOrEqual(el.constraints.absoluteMin - 0.1);
      }
    });

    it('all elements stay above absoluteMin even under severe compression', () => {
      for (const template of templates) {
        const street = adaptTemplate(template, 20);
        for (const el of street.elements) {
          expect(el.width).toBeGreaterThanOrEqual(el.constraints.absoluteMin - 0.1);
        }
      }
    });
  });

  describe('expansion', () => {
    it('distributes extra width when expanding from 60ft to 80ft', () => {
      const template = getTemplateById('road-diet-4to3')!;
      const street60 = adaptTemplate(template, 60);
      const street80 = adaptTemplate(template, 80);

      // The 80ft version should have wider elements overall
      const sum60 = street60.elements.reduce((a, el) => a + el.width, 0);
      const sum80 = street80.elements.reduce((a, el) => a + el.width, 0);
      expect(sum80).toBeGreaterThan(sum60);
    });

    it('does not exceed absoluteMax for any element', () => {
      for (const template of templates) {
        const street = adaptTemplate(template, 150);
        for (const el of street.elements) {
          expect(el.width).toBeLessThanOrEqual(el.constraints.absoluteMax + 0.1);
        }
      }
    });
  });

  describe('locked elements', () => {
    it('locked elements (curbs) remain at their original width', () => {
      const template = getTemplateById('road-diet-4to3')!;
      const street = adaptTemplate(template, 80);

      const curbs = street.elements.filter((el) => el.type === 'curb');
      for (const curb of curbs) {
        expect(curb.width).toBe(0.5);
      }
    });
  });

  describe('metadata', () => {
    it('sets templateId in metadata', () => {
      const template = getTemplateById('transit-priority-brt')!;
      const street = adaptTemplate(template, 100);

      expect(street.metadata.templateId).toBe('transit-priority-brt');
    });

    it('sets createdAt and updatedAt to current time', () => {
      const before = new Date().toISOString();
      const template = getTemplateById('shared-street-residential')!;
      const street = adaptTemplate(template, 30);
      const after = new Date().toISOString();

      expect(street.metadata.createdAt >= before).toBe(true);
      expect(street.metadata.createdAt <= after).toBe(true);
    });
  });
});
