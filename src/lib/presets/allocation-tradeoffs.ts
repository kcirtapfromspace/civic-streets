import type { StreetSegment } from '@/lib/types';
import { ELEMENT_COLORS } from '@/lib/constants';

/** Compare actual fitted dimensions, never a template's advertised benefits. */
export function allocationTradeoffs(before: StreetSegment, after: StreetSegment): string[] {
  const changes: string[] = [];
  const types = new Set([...before.elements, ...after.elements].map((element) => element.type));
  for (const type of types) {
    const previous = before.elements.filter((element) => element.type === type);
    const next = after.elements.filter((element) => element.type === type);
    const sum = (elements: typeof previous) => Number(elements.reduce((total, element) => total + element.width, 0).toFixed(1));
    const from = sum(previous);
    const to = sum(next);
    const label = ELEMENT_COLORS[type].label;
    if (from === 0 && to > 0) changes.push(`Adds ${to} ft of ${label.toLowerCase()} space.`);
    else if (from > 0 && to === 0) changes.push(`Removes ${from} ft of ${label.toLowerCase()} space.`);
    else if (from !== to) changes.push(`${label}: ${from} → ${to} ft in total (${Number(Math.abs(to - from).toFixed(1))} ft ${to < from ? 'less' : 'more'}).`);
    if (type === 'sidewalk') {
      for (const side of ['left', 'right'] as const) {
        const oldSide = previous.filter((element) => element.side === side);
        const newSide = next.filter((element) => element.side === side);
        if (oldSide.length && newSide.length && sum(newSide) < sum(oldSide)) {
          changes.push(`${side === 'left' ? 'Left' : 'Right'} sidewalk becomes ${Number((sum(oldSide) - sum(newSide)).toFixed(1))} ft narrower.`);
        }
      }
    }
  }
  const used = after.elements.reduce((total, element) => total + element.width, 0);
  if (Math.abs(used - after.totalROWWidth) > 0.1) changes.push(`This option uses ${Number(used.toFixed(1))} ft within an assumed ${after.totalROWWidth} ft street. Widths need review.`);
  return changes.length ? changes : ['No change in space allocated to each element type.'];
}
