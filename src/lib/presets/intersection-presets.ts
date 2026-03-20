import type { IntersectionConditions } from '@/lib/types/intersection';

export interface IntersectionPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  conditions: IntersectionConditions;
}

export const INTERSECTION_PRESETS: IntersectionPreset[] = [
  {
    id: 'uncontrolled',
    label: 'Uncontrolled residential',
    description: 'No signs or signals, residential neighborhood',
    icon: '🏘',
    conditions: {
      shape: 'four-way',
      trafficControl: 'uncontrolled',
      crossingType: 'none',
      hasCurbRamps: false,
      hasPedestrianSignal: false,
      hasTransitStop: false,
    },
  },
  {
    id: 'two-way-stop',
    label: 'Two-way stop',
    description: 'Stop signs on minor street only',
    icon: '🛑',
    conditions: {
      shape: 'four-way',
      trafficControl: 'two-way-stop',
      crossingType: 'unmarked',
      hasCurbRamps: false,
      hasPedestrianSignal: false,
      hasTransitStop: false,
    },
  },
  {
    id: 'all-way-stop',
    label: 'All-way stop',
    description: 'Stop signs on all approaches',
    icon: '✋',
    conditions: {
      shape: 'four-way',
      trafficControl: 'all-way-stop',
      crossingType: 'standard-crosswalk',
      hasCurbRamps: true,
      hasPedestrianSignal: false,
      hasTransitStop: false,
    },
  },
  {
    id: 'signalized-basic',
    label: 'Signalized, basic',
    description: 'Traffic signal with standard crosswalks',
    icon: '🚦',
    conditions: {
      shape: 'four-way',
      trafficControl: 'signalized',
      crossingType: 'standard-crosswalk',
      hasCurbRamps: true,
      hasPedestrianSignal: false,
      hasTransitStop: false,
    },
  },
  {
    id: 'signalized-full',
    label: 'Signalized with ped phase',
    description: 'Traffic signal, high-visibility crosswalks, ped countdown',
    icon: '🚶',
    conditions: {
      shape: 'four-way',
      trafficControl: 'signalized',
      crossingType: 'high-visibility-crosswalk',
      hasCurbRamps: true,
      hasPedestrianSignal: true,
      hasTransitStop: false,
    },
  },
];
