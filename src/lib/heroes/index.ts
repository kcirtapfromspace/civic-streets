import type { StreetSegment } from '@/lib/types';
import { DEFAULT_CONSTRAINTS } from '@/lib/constants';

import roadDietData from '../../../data/heroes/road-diet-hero.json';
import protectedBikeData from '../../../data/heroes/protected-bike-hero.json';
import transitPriorityData from '../../../data/heroes/transit-priority-hero.json';

export interface HeroExample {
  segment: StreetSegment;
  before: StreetSegment;
  description: string;
  highlights: string[];
}

// ── Before states ──────────────────────────────────────────────────────
// Simplified pre-redesign layouts representing the "before" condition.

// Road Diet Before: 5 + 0.5 + 12 + 12 + 12 + 12 + 0.5 + 6 = 60
const roadDietBefore: StreetSegment = {
  id: 'hero-road-diet-before',
  name: 'Main Street (Before)',
  totalROWWidth: 60,
  curbToCurbWidth: 48,
  direction: 'two-way',
  functionalClass: 'minor-arterial',
  elements: [
    {
      id: 'rd-b-sw-l',
      type: 'sidewalk',
      side: 'left',
      width: 5,
      constraints: DEFAULT_CONSTRAINTS['sidewalk'],
      locked: false,
      label: 'Sidewalk',
    },
    {
      id: 'rd-b-curb-l',
      type: 'curb',
      side: 'left',
      width: 0.5,
      constraints: DEFAULT_CONSTRAINTS['curb'],
      locked: false,
      label: 'Curb',
    },
    {
      id: 'rd-b-tl-1',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'rd-b-tl-2',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'rd-b-tl-3',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'rd-b-tl-4',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'rd-b-curb-r',
      type: 'curb',
      side: 'right',
      width: 0.5,
      constraints: DEFAULT_CONSTRAINTS['curb'],
      locked: false,
      label: 'Curb',
    },
    {
      id: 'rd-b-sw-r',
      type: 'sidewalk',
      side: 'right',
      width: 6,
      constraints: DEFAULT_CONSTRAINTS['sidewalk'],
      locked: false,
      label: 'Sidewalk',
    },
  ],
  metadata: {
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  },
};

// Protected Bike Before: 6 + 5.5 + 0.5 + 9 + 12 + 12 + 9 + 0.5 + 5.5 + 6 = 66
const protectedBikeBefore: StreetSegment = {
  id: 'hero-protected-bike-before',
  name: 'Oak Avenue (Before)',
  totalROWWidth: 66,
  curbToCurbWidth: 42,
  direction: 'two-way',
  functionalClass: 'collector',
  elements: [
    {
      id: 'pb-b-sw-l',
      type: 'sidewalk',
      side: 'left',
      width: 6,
      constraints: DEFAULT_CONSTRAINTS['sidewalk'],
      locked: false,
      label: 'Sidewalk',
    },
    {
      id: 'pb-b-ps-l',
      type: 'planting-strip',
      side: 'left',
      width: 5.5,
      constraints: DEFAULT_CONSTRAINTS['planting-strip'],
      locked: false,
      label: 'Planting Strip',
    },
    {
      id: 'pb-b-curb-l',
      type: 'curb',
      side: 'left',
      width: 0.5,
      constraints: DEFAULT_CONSTRAINTS['curb'],
      locked: false,
      label: 'Curb',
    },
    {
      id: 'pb-b-pk-l',
      type: 'parking-lane',
      side: 'left',
      width: 9,
      constraints: DEFAULT_CONSTRAINTS['parking-lane'],
      locked: false,
      label: 'Parking Lane',
    },
    {
      id: 'pb-b-tl-1',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'pb-b-tl-2',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'pb-b-pk-r',
      type: 'parking-lane',
      side: 'right',
      width: 9,
      constraints: DEFAULT_CONSTRAINTS['parking-lane'],
      locked: false,
      label: 'Parking Lane',
    },
    {
      id: 'pb-b-curb-r',
      type: 'curb',
      side: 'right',
      width: 0.5,
      constraints: DEFAULT_CONSTRAINTS['curb'],
      locked: false,
      label: 'Curb',
    },
    {
      id: 'pb-b-ps-r',
      type: 'planting-strip',
      side: 'right',
      width: 5.5,
      constraints: DEFAULT_CONSTRAINTS['planting-strip'],
      locked: false,
      label: 'Planting Strip',
    },
    {
      id: 'pb-b-sw-r',
      type: 'sidewalk',
      side: 'right',
      width: 6,
      constraints: DEFAULT_CONSTRAINTS['sidewalk'],
      locked: false,
      label: 'Sidewalk',
    },
  ],
  metadata: {
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  },
};

// Transit Priority Before: 7 + 0.5 + 8 + 12 + 12 + 12 + 12 + 8 + 0.5 + 8 = 80
const transitPriorityBefore: StreetSegment = {
  id: 'hero-transit-priority-before',
  name: 'Broadway (Before)',
  totalROWWidth: 80,
  curbToCurbWidth: 64,
  direction: 'two-way',
  functionalClass: 'major-arterial',
  elements: [
    {
      id: 'tp-b-sw-l',
      type: 'sidewalk',
      side: 'left',
      width: 7,
      constraints: DEFAULT_CONSTRAINTS['sidewalk'],
      locked: false,
      label: 'Sidewalk',
    },
    {
      id: 'tp-b-curb-l',
      type: 'curb',
      side: 'left',
      width: 0.5,
      constraints: DEFAULT_CONSTRAINTS['curb'],
      locked: false,
      label: 'Curb',
    },
    {
      id: 'tp-b-pk-l',
      type: 'parking-lane',
      side: 'left',
      width: 8,
      constraints: DEFAULT_CONSTRAINTS['parking-lane'],
      locked: false,
      label: 'Parking Lane',
    },
    {
      id: 'tp-b-tl-1',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'tp-b-tl-2',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'tp-b-tl-3',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'tp-b-tl-4',
      type: 'travel-lane',
      side: 'center',
      width: 12,
      constraints: DEFAULT_CONSTRAINTS['travel-lane'],
      locked: false,
      label: 'Travel Lane',
    },
    {
      id: 'tp-b-pk-r',
      type: 'parking-lane',
      side: 'right',
      width: 8,
      constraints: DEFAULT_CONSTRAINTS['parking-lane'],
      locked: false,
      label: 'Parking Lane',
    },
    {
      id: 'tp-b-curb-r',
      type: 'curb',
      side: 'right',
      width: 0.5,
      constraints: DEFAULT_CONSTRAINTS['curb'],
      locked: false,
      label: 'Curb',
    },
    {
      id: 'tp-b-sw-r',
      type: 'sidewalk',
      side: 'right',
      width: 8,
      constraints: DEFAULT_CONSTRAINTS['sidewalk'],
      locked: false,
      label: 'Sidewalk',
    },
  ],
  metadata: {
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  },
};

// ── Hero definitions ───────────────────────────────────────────────────

const HEROES: HeroExample[] = [
  {
    segment: roadDietData as unknown as StreetSegment,
    before: roadDietBefore,
    description:
      'A classic 4-to-3 road diet on a 60 ft minor arterial. Converts four 12 ft travel lanes into two travel lanes, a center turn lane, and bike lanes on both sides.',
    highlights: [
      '4-to-3 lane conversion with center turn lane',
      'Bike lanes added on both sides',
      'Reduced crossing distance for pedestrians',
      'Proven crash reduction of 19-47% (FHWA)',
    ],
  },
  {
    segment: protectedBikeData as unknown as StreetSegment,
    before: protectedBikeBefore,
    description:
      'Parking-protected bike lanes on a 66 ft collector street. Parked cars serve as a physical barrier between cyclists and moving traffic.',
    highlights: [
      'Parking-protected bike lanes on both sides',
      'Physical separation via parked cars + buffer',
      'Retains on-street parking for local businesses',
      'Low-stress cycling suitable for all ages and abilities',
    ],
  },
  {
    segment: transitPriorityData as unknown as StreetSegment,
    before: transitPriorityBefore,
    description:
      'A major arterial redesigned with a dedicated center transit lane and protected bike lanes. Prioritizes high-capacity modes while maintaining one general travel lane per direction.',
    highlights: [
      'Dedicated center-running transit lane',
      'Protected bike lanes with 3 ft buffers',
      'Wide sidewalks with furniture zones',
      'Moves more people in less space',
    ],
  },
];

/**
 * Load all hero examples.
 */
export function loadHeroes(): HeroExample[] {
  return HEROES;
}

/**
 * Get a specific hero example by segment ID.
 */
export function getHeroById(id: string): HeroExample | null {
  return HEROES.find((h) => h.segment.id === id) ?? null;
}
