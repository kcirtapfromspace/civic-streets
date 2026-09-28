import { describe, expect, it } from 'vitest';
import { allocationTradeoffs } from './allocation-tradeoffs';
import { BEFORE_PRESETS } from './before-presets';
import { adaptTemplate, loadTemplates } from '@/lib/templates';
import { useProposalStore } from '@/stores/proposal-store';

describe('fitted option tradeoffs', () => {
  it('makes the walking-space loss visible before accepting a complete street', () => {
    useProposalStore.getState().selectPreset(BEFORE_PRESETS[1]);
    const before = useProposalStore.getState().beforeStreet!;
    const template = loadTemplates().find((item) => item.id === 'complete-street-local')!;
    const after = adaptTemplate(template, before.totalROWWidth);
    const changes = allocationTradeoffs(before, after);
    expect(changes).toContain('Left sidewalk becomes 1 ft narrower.');
    expect(changes).toContain('Right sidewalk becomes 1 ft narrower.');
    expect(changes).toContain('Sidewalk: 12 → 10 ft in total (2 ft less).');
    expect(allocationTradeoffs(before, { ...after, elements: after.elements.filter((element) => element.type !== 'parking-lane') })).toContain('Removes 16 ft of parking lane space.');
    expect(changes.some((line) => line.startsWith('Adds'))).toBe(true);
  });
  it('reports growth, no allocation change, and infeasible fitting without promising outcomes', () => {
    const template = loadTemplates()[0];
    const street = adaptTemplate(template, 80);
    expect(allocationTradeoffs(street, street)).toEqual(['No change in space allocated to each element type.']);
    const wider = { ...street, elements: street.elements.map((element) => ({ ...element, width: element.width + 1 })) };
    expect(allocationTradeoffs(street, wider).some((line) => line.includes('ft more'))).toBe(true);
    expect(allocationTradeoffs(street, wider).at(-1)).toContain('Widths need review');
  });
});
