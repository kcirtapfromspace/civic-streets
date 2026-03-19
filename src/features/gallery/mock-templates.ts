import type { TemplateDefinition } from '@/lib/types';
import { DEFAULT_CONSTRAINTS } from '@/lib/constants';

/**
 * Mock templates for Round 1. These will be replaced by real data
 * from loadTemplates() (WS3) in Round 2.
 */
export const MOCK_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'tmpl-road-diet-60',
    name: 'Road Diet — 4-to-3 Conversion',
    description:
      'Converts a 4-lane road to 3 lanes with bike lanes and wider sidewalks. Classic road diet pattern recommended by NACTO for streets under 20,000 ADT.',
    category: 'road-diet',
    applicableROWWidths: [60, 66, 70],
    applicableFunctionalClasses: ['collector', 'minor-arterial'],
    elements: [
      { type: 'sidewalk', side: 'left', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
      { type: 'planting-strip', side: 'left', width: 4, constraints: DEFAULT_CONSTRAINTS['planting-strip'], locked: false, label: 'Planting Strip' },
      { type: 'curb', side: 'left', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'bike-lane', side: 'left', width: 5, constraints: DEFAULT_CONSTRAINTS['bike-lane'], locked: false, label: 'Bike Lane' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'turn-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['turn-lane'], locked: false, label: 'Turn Lane' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'bike-lane', side: 'right', width: 5, constraints: DEFAULT_CONSTRAINTS['bike-lane'], locked: false, label: 'Bike Lane' },
      { type: 'curb', side: 'right', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'sidewalk', side: 'right', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
    ],
    tags: ['road-diet', '4-to-3', 'bike-lanes', 'nacto'],
  },
  {
    id: 'tmpl-protected-bike-80',
    name: 'Protected Bike Lanes — Two-Way',
    description:
      'Two-way street with protected bike lanes separated by buffers. Includes planting strips and 6-foot sidewalks on both sides.',
    category: 'protected-bike',
    applicableROWWidths: [80, 84, 100],
    applicableFunctionalClasses: ['collector', 'minor-arterial', 'major-arterial'],
    elements: [
      { type: 'sidewalk', side: 'left', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
      { type: 'planting-strip', side: 'left', width: 4, constraints: DEFAULT_CONSTRAINTS['planting-strip'], locked: false, label: 'Planting Strip' },
      { type: 'curb', side: 'left', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'bike-lane-protected', side: 'left', width: 7, constraints: DEFAULT_CONSTRAINTS['bike-lane-protected'], locked: false, label: 'Protected Bike Lane' },
      { type: 'buffer', side: 'left', width: 3, constraints: DEFAULT_CONSTRAINTS['buffer'], locked: false, label: 'Buffer' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'buffer', side: 'right', width: 3, constraints: DEFAULT_CONSTRAINTS['buffer'], locked: false, label: 'Buffer' },
      { type: 'bike-lane-protected', side: 'right', width: 7, constraints: DEFAULT_CONSTRAINTS['bike-lane-protected'], locked: false, label: 'Protected Bike Lane' },
      { type: 'curb', side: 'right', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'planting-strip', side: 'right', width: 4, constraints: DEFAULT_CONSTRAINTS['planting-strip'], locked: false, label: 'Planting Strip' },
      { type: 'sidewalk', side: 'right', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
    ],
    tags: ['protected', 'bike-lanes', 'buffer', 'safe-routes'],
  },
  {
    id: 'tmpl-transit-priority-84',
    name: 'Transit Priority Corridor',
    description:
      'Dedicated transit lanes in both directions with standard travel lanes. Designed for BRT or high-frequency bus corridors per NACTO Transit Street Design Guide.',
    category: 'transit-priority',
    applicableROWWidths: [80, 84, 100, 120],
    applicableFunctionalClasses: ['minor-arterial', 'major-arterial'],
    elements: [
      { type: 'sidewalk', side: 'left', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
      { type: 'furniture-zone', side: 'left', width: 4, constraints: DEFAULT_CONSTRAINTS['furniture-zone'], locked: false, label: 'Furniture Zone' },
      { type: 'curb', side: 'left', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'transit-lane', side: 'center', width: 12, constraints: DEFAULT_CONSTRAINTS['transit-lane'], locked: false, label: 'Transit Lane' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'median', side: 'center', width: 6, constraints: DEFAULT_CONSTRAINTS['median'], locked: false, label: 'Median' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'transit-lane', side: 'center', width: 12, constraints: DEFAULT_CONSTRAINTS['transit-lane'], locked: false, label: 'Transit Lane' },
      { type: 'curb', side: 'right', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'furniture-zone', side: 'right', width: 4, constraints: DEFAULT_CONSTRAINTS['furniture-zone'], locked: false, label: 'Furniture Zone' },
      { type: 'sidewalk', side: 'right', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
    ],
    tags: ['transit', 'brt', 'bus-lanes', 'priority'],
  },
  {
    id: 'tmpl-complete-street-66',
    name: 'Complete Street — Neighborhood',
    description:
      'Balanced complete street for local/collector roads. Includes sidewalks, planting strips, parking, and travel lanes within a 66-foot ROW.',
    category: 'complete-street',
    applicableROWWidths: [60, 66, 70],
    applicableFunctionalClasses: ['local', 'collector'],
    elements: [
      { type: 'sidewalk', side: 'left', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
      { type: 'planting-strip', side: 'left', width: 5, constraints: DEFAULT_CONSTRAINTS['planting-strip'], locked: false, label: 'Planting Strip' },
      { type: 'curb', side: 'left', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'parking-lane', side: 'left', width: 8, constraints: DEFAULT_CONSTRAINTS['parking-lane'], locked: false, label: 'Parking' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'travel-lane', side: 'center', width: 10, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Travel Lane' },
      { type: 'parking-lane', side: 'right', width: 8, constraints: DEFAULT_CONSTRAINTS['parking-lane'], locked: false, label: 'Parking' },
      { type: 'curb', side: 'right', width: 0.5, constraints: DEFAULT_CONSTRAINTS['curb'], locked: false, label: 'Curb' },
      { type: 'planting-strip', side: 'right', width: 5, constraints: DEFAULT_CONSTRAINTS['planting-strip'], locked: false, label: 'Planting Strip' },
      { type: 'sidewalk', side: 'right', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Sidewalk' },
    ],
    tags: ['complete-street', 'parking', 'neighborhood', 'balanced'],
  },
  {
    id: 'tmpl-shared-street-30',
    name: 'Shared Street / Woonerf',
    description:
      'Low-speed shared-space design for narrow ROWs. No curbs — flush surface with bollard-delineated pedestrian zone. Suitable for residential or commercial alleys.',
    category: 'shared-street',
    applicableROWWidths: [30, 40],
    applicableFunctionalClasses: ['local'],
    elements: [
      { type: 'sidewalk', side: 'left', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Pedestrian Zone' },
      { type: 'furniture-zone', side: 'left', width: 3, constraints: DEFAULT_CONSTRAINTS['furniture-zone'], locked: false, label: 'Bollards/Planters' },
      { type: 'travel-lane', side: 'center', width: 12, constraints: DEFAULT_CONSTRAINTS['travel-lane'], locked: false, label: 'Shared Travel' },
      { type: 'furniture-zone', side: 'right', width: 3, constraints: DEFAULT_CONSTRAINTS['furniture-zone'], locked: false, label: 'Bollards/Planters' },
      { type: 'sidewalk', side: 'right', width: 6, constraints: DEFAULT_CONSTRAINTS['sidewalk'], locked: false, label: 'Pedestrian Zone' },
    ],
    tags: ['shared-street', 'woonerf', 'low-speed', 'narrow'],
  },
];
