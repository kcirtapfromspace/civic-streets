// Maps preset IDs → available transformations with friendly labels and icons.
// Template IDs reference the JSON files in data/templates/.

export interface TransformationCard {
  templateId: string;
  label: string;
  description: string;
  icon: 'bike' | 'diet' | 'complete' | 'transit' | 'shared';
}

const ALL_TRANSFORMATIONS: Record<string, TransformationCard> = {
  'road-diet-4to3': {
    templateId: 'road-diet-4to3',
    label: 'Road Diet',
    description: '4 lanes → 3 with bike lanes and a center turn lane',
    icon: 'diet',
  },
  'road-diet-with-parking': {
    templateId: 'road-diet-with-parking',
    label: 'Road Diet + Parking',
    description: 'Fewer lanes with on-street parking and bike lanes',
    icon: 'diet',
  },
  'protected-bike-lane-one-way': {
    templateId: 'protected-bike-lane-one-way',
    label: 'Protected Bike Lanes',
    description: 'One-way protected bike lanes on each side with physical buffer',
    icon: 'bike',
  },
  'protected-bike-lane-two-way': {
    templateId: 'protected-bike-lane-two-way',
    label: 'Two-Way Bike Lane',
    description: 'Protected two-way cycle track on one side of the street',
    icon: 'bike',
  },
  'protected-bike-lane-parking': {
    templateId: 'protected-bike-lane-parking',
    label: 'Bike Lanes + Parking',
    description: 'Protected bike lanes with parking-separated buffer',
    icon: 'bike',
  },
  'complete-street-local': {
    templateId: 'complete-street-local',
    label: 'Complete Street (Local)',
    description: 'Planting strips, wide sidewalks, and traffic calming',
    icon: 'complete',
  },
  'complete-street-collector': {
    templateId: 'complete-street-collector',
    label: 'Complete Street',
    description: 'Balanced design with space for all modes of travel',
    icon: 'complete',
  },
  'transit-priority-brt': {
    templateId: 'transit-priority-brt',
    label: 'BRT / Transit Priority',
    description: 'Dedicated bus lanes with enhanced pedestrian space',
    icon: 'transit',
  },
  'transit-priority-dedicated': {
    templateId: 'transit-priority-dedicated',
    label: 'Dedicated Transit',
    description: 'Full transit-priority corridor with dedicated lanes',
    icon: 'transit',
  },
  'shared-street-residential': {
    templateId: 'shared-street-residential',
    label: 'Shared Street',
    description: 'Slow-speed shared space for people and vehicles',
    icon: 'shared',
  },
  'shared-street-commercial': {
    templateId: 'shared-street-commercial',
    label: 'Shared Street (Commercial)',
    description: 'Festival-style shared space for commercial districts',
    icon: 'shared',
  },
};

/**
 * Get transformation cards for a given before-preset.
 * Returns only the transformations suggested by the preset.
 */
export function getTransformationsForPreset(
  suggestedIds: string[],
): TransformationCard[] {
  return suggestedIds
    .map((id) => ALL_TRANSFORMATIONS[id])
    .filter(Boolean);
}
