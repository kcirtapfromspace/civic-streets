import { describe, it, expect } from 'vitest';
import { loadTemplates, getTemplateById, filterTemplates } from '../loader';

describe('loadTemplates', () => {
  it('loads all 12 template JSON files', () => {
    const templates = loadTemplates();
    expect(templates).toHaveLength(12);
  });

  it('returns templates that conform to the TemplateDefinition interface', () => {
    const templates = loadTemplates();
    for (const t of templates) {
      expect(t.id).toBeDefined();
      expect(typeof t.id).toBe('string');
      expect(t.name).toBeDefined();
      expect(t.description).toBeDefined();
      expect(t.category).toBeDefined();
      expect(t.applicableROWWidths).toBeInstanceOf(Array);
      expect(t.applicableROWWidths.length).toBeGreaterThan(0);
      expect(t.applicableFunctionalClasses).toBeInstanceOf(Array);
      expect(t.applicableFunctionalClasses.length).toBeGreaterThan(0);
      expect(t.elements).toBeInstanceOf(Array);
      expect(t.elements.length).toBeGreaterThan(0);
      expect(t.tags).toBeInstanceOf(Array);
    }
  });

  it('each template has element widths summing to its first applicableROWWidth', () => {
    const templates = loadTemplates();
    for (const t of templates) {
      const sum = t.elements.reduce((acc, el) => acc + el.width, 0);
      const designedROW = t.applicableROWWidths[0];
      expect(Math.abs(sum - designedROW)).toBeLessThan(0.02);
    }
  });

  it('each element has valid constraints', () => {
    const templates = loadTemplates();
    for (const t of templates) {
      for (const el of t.elements) {
        expect(el.constraints.absoluteMin).toBeLessThanOrEqual(el.constraints.recommendedMin);
        expect(el.constraints.recommendedMin).toBeLessThanOrEqual(el.constraints.recommended);
        expect(el.constraints.recommended).toBeLessThanOrEqual(el.constraints.absoluteMax);
        expect(el.constraints.source).toBeTruthy();
        expect(typeof el.constraints.prowagRequired).toBe('boolean');
      }
    }
  });

  it('all template IDs are unique', () => {
    const templates = loadTemplates();
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getTemplateById', () => {
  it('returns the correct template for a known ID', () => {
    const template = getTemplateById('road-diet-4to3');
    expect(template).not.toBeNull();
    expect(template!.id).toBe('road-diet-4to3');
    expect(template!.category).toBe('road-diet');
  });

  it('returns null for an unknown ID', () => {
    const template = getTemplateById('nonexistent-template');
    expect(template).toBeNull();
  });

  it('returns each of the 12 templates by ID', () => {
    const templates = loadTemplates();
    for (const t of templates) {
      const found = getTemplateById(t.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(t.id);
    }
  });
});

describe('filterTemplates', () => {
  it('returns all templates when no filters are provided', () => {
    const results = filterTemplates({});
    expect(results).toHaveLength(12);
  });

  it('filters by category: road-diet', () => {
    const results = filterTemplates({ category: 'road-diet' });
    expect(results.length).toBe(2);
    for (const t of results) {
      expect(t.category).toBe('road-diet');
    }
  });

  it('filters by category: protected-bike', () => {
    const results = filterTemplates({ category: 'protected-bike' });
    expect(results.length).toBe(3);
    for (const t of results) {
      expect(t.category).toBe('protected-bike');
    }
  });

  it('filters by category: transit-priority', () => {
    const results = filterTemplates({ category: 'transit-priority' });
    expect(results.length).toBe(2);
    for (const t of results) {
      expect(t.category).toBe('transit-priority');
    }
  });

  it('filters by category: complete-street', () => {
    const results = filterTemplates({ category: 'complete-street' });
    expect(results.length).toBe(3);
    for (const t of results) {
      expect(t.category).toBe('complete-street');
    }
  });

  it('filters by category: shared-street', () => {
    const results = filterTemplates({ category: 'shared-street' });
    expect(results.length).toBe(2);
    for (const t of results) {
      expect(t.category).toBe('shared-street');
    }
  });

  it('filters by ROW width 66', () => {
    const results = filterTemplates({ rowWidth: 66 });
    for (const t of results) {
      expect(t.applicableROWWidths).toContain(66);
    }
    expect(results.length).toBeGreaterThan(0);
  });

  it('filters by ROW width 30 returns only shared-street-residential', () => {
    const results = filterTemplates({ rowWidth: 30 });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('shared-street-residential');
  });

  it('filters by functionalClass', () => {
    const results = filterTemplates({ functionalClass: 'major-arterial' });
    for (const t of results) {
      expect(t.applicableFunctionalClasses).toContain('major-arterial');
    }
    expect(results.length).toBeGreaterThan(0);
  });

  it('filters by tags (OR logic within tags)', () => {
    const results = filterTemplates({ tags: ['brt'] });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('transit-priority-brt');
  });

  it('combines category and rowWidth filters (AND logic)', () => {
    const results = filterTemplates({ category: 'protected-bike', rowWidth: 80 });
    for (const t of results) {
      expect(t.category).toBe('protected-bike');
      expect(t.applicableROWWidths).toContain(80);
    }
  });

  it('returns empty array when no templates match', () => {
    const results = filterTemplates({ category: 'transit-priority', rowWidth: 30 });
    expect(results).toHaveLength(0);
  });
});
