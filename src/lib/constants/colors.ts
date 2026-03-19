import type { ElementType } from '@/lib/types';

// Color palette per element type — used in SVG renderer and UI
export const ELEMENT_COLORS: Record<ElementType, { fill: string; stroke: string; label: string }> = {
  'sidewalk':            { fill: '#D4C4A8', stroke: '#B8A88C', label: 'Sidewalk' },
  'planting-strip':      { fill: '#7CB342', stroke: '#558B2F', label: 'Planting Strip' },
  'furniture-zone':      { fill: '#A1887F', stroke: '#8D6E63', label: 'Furniture Zone' },
  'bike-lane':           { fill: '#4CAF50', stroke: '#388E3C', label: 'Bike Lane' },
  'bike-lane-protected': { fill: '#2E7D32', stroke: '#1B5E20', label: 'Protected Bike Lane' },
  'buffer':              { fill: '#BDBDBD', stroke: '#9E9E9E', label: 'Buffer' },
  'parking-lane':        { fill: '#78909C', stroke: '#546E7A', label: 'Parking Lane' },
  'travel-lane':         { fill: '#424242', stroke: '#212121', label: 'Travel Lane' },
  'turn-lane':           { fill: '#616161', stroke: '#424242', label: 'Turn Lane' },
  'transit-lane':        { fill: '#E53935', stroke: '#C62828', label: 'Transit Lane' },
  'median':              { fill: '#8BC34A', stroke: '#689F38', label: 'Median' },
  'curb':                { fill: '#9E9E9E', stroke: '#757575', label: 'Curb' },
};

// Validation severity colors
export const SEVERITY_COLORS: Record<string, string> = {
  error: '#E53935',
  warning: '#FB8C00',
  info: '#1E88E5',
};
