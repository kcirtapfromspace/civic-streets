import type { ElementType, DimensionalConstraint } from '@/lib/types';

// Default dimensional constraints per element type
// Sources: NACTO Urban Street Design Guide, PROWAG R302
export const DEFAULT_CONSTRAINTS: Record<ElementType, DimensionalConstraint> = {
  'sidewalk': {
    absoluteMin: 4,         // PROWAG R302.3 minimum clear width
    recommendedMin: 5,
    recommended: 6,
    absoluteMax: 20,
    source: 'PROWAG R302.3; NACTO USDG p.39',
    prowagRequired: true,
  },
  'planting-strip': {
    absoluteMin: 2,
    recommendedMin: 4,
    recommended: 6,
    absoluteMax: 12,
    source: 'NACTO USDG p.43',
    prowagRequired: false,
  },
  'furniture-zone': {
    absoluteMin: 2,
    recommendedMin: 4,
    recommended: 5,
    absoluteMax: 10,
    source: 'NACTO USDG p.41',
    prowagRequired: false,
  },
  'bike-lane': {
    absoluteMin: 4,
    recommendedMin: 5,
    recommended: 6,
    absoluteMax: 8,
    source: 'NACTO USDG p.126',
    prowagRequired: false,
  },
  'bike-lane-protected': {
    absoluteMin: 5,
    recommendedMin: 6.5,
    recommended: 7,
    absoluteMax: 12,
    source: 'NACTO USDG p.150',
    prowagRequired: false,
  },
  'buffer': {
    absoluteMin: 1.5,
    recommendedMin: 3,
    recommended: 3,
    absoluteMax: 6,
    source: 'NACTO USDG p.152',
    prowagRequired: false,
  },
  'parking-lane': {
    absoluteMin: 7,
    recommendedMin: 7.5,
    recommended: 8,
    absoluteMax: 10,
    source: 'NACTO USDG p.84',
    prowagRequired: false,
  },
  'travel-lane': {
    absoluteMin: 9,
    recommendedMin: 10,
    recommended: 10,
    absoluteMax: 12,
    source: 'NACTO USDG p.74',
    prowagRequired: false,
  },
  'turn-lane': {
    absoluteMin: 9,
    recommendedMin: 10,
    recommended: 10,
    absoluteMax: 12,
    source: 'NACTO USDG p.77',
    prowagRequired: false,
  },
  'transit-lane': {
    absoluteMin: 10,
    recommendedMin: 11,
    recommended: 12,
    absoluteMax: 14,
    source: 'NACTO Transit Street Design Guide p.62',
    prowagRequired: false,
  },
  'median': {
    absoluteMin: 4,
    recommendedMin: 6,
    recommended: 8,
    absoluteMax: 20,
    source: 'NACTO USDG p.80',
    prowagRequired: false,
  },
  'curb': {
    absoluteMin: 0.5,
    recommendedMin: 0.5,
    recommended: 0.5,
    absoluteMax: 1,
    source: 'NACTO USDG p.38',
    prowagRequired: false,
  },
};

// Common right-of-way widths (feet)
export const COMMON_ROW_WIDTHS = [30, 40, 50, 60, 66, 70, 80, 84, 100, 120] as const;

// Default element widths (feet)
export const DEFAULT_WIDTHS: Record<ElementType, number> = {
  'sidewalk': 6,
  'planting-strip': 5,
  'furniture-zone': 4,
  'bike-lane': 5,
  'bike-lane-protected': 7,
  'buffer': 3,
  'parking-lane': 8,
  'travel-lane': 10,
  'turn-lane': 10,
  'transit-lane': 12,
  'median': 8,
  'curb': 0.5,
};

export const UNITS = {
  primary: 'ft' as const,
  label: 'feet' as const,
};
