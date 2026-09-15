import { expect, it } from 'vitest';
import { getHeroById, loadHeroes } from './index';

it('resolves every published before/after example with consistent street geometry', () => {
  const heroes = loadHeroes();
  expect(heroes).toHaveLength(3);
  for (const hero of heroes) {
    expect(getHeroById(hero.segment.id)).toBe(hero);
    expect(hero.description.length).toBeGreaterThan(20);
    expect(hero.highlights.length).toBeGreaterThan(0);
    expect(hero.before.totalROWWidth).toBe(hero.segment.totalROWWidth);
    for (const segment of [hero.before, hero.segment]) {
      expect(new Set(segment.elements.map((element) => element.id)).size).toBe(
        segment.elements.length,
      );
      expect(
        segment.elements.every((element) => Number.isFinite(element.width) && element.width > 0),
      ).toBe(true);
      expect(segment.elements.reduce((sum, element) => sum + element.width, 0)).toBeCloseTo(
        segment.totalROWWidth,
      );
    }
  }
  expect(getHeroById('missing')).toBeNull();
});
