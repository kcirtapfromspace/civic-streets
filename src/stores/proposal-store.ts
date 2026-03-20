import { create } from 'zustand';
import type {
  StreetSegment,
  StreetLocation,
  BeforePreset,
  StreetProposal,
  TemplateDefinition,
  CrossSectionElement,
  ElementType,
} from '@/lib/types';
import { adaptTemplate } from '@/lib/templates/adapter';

export type ProposalStep =
  | 'street-selected'
  | 'before-selected'
  | 'transform-selected'
  | 'review';

const CURB_TO_CURB_TYPES: Set<ElementType> = new Set([
  'bike-lane', 'bike-lane-protected', 'buffer', 'parking-lane',
  'travel-lane', 'turn-lane', 'transit-lane', 'median',
]);

function computeCurbToCurb(elements: CrossSectionElement[]): number {
  return parseFloat(
    elements
      .filter((el) => CURB_TO_CURB_TYPES.has(el.type))
      .reduce((sum, el) => sum + el.width, 0)
      .toFixed(2),
  );
}

export interface ProposalState {
  step: ProposalStep;
  streetName: string;
  location: StreetLocation | null;
  roadPath: Array<{ lat: number; lng: number }>;
  bearing: number;

  selectedPreset: BeforePreset | null;
  beforePresetId: string | null;
  beforeStreet: StreetSegment | null;
  afterStreet: StreetSegment | null;
  selectedTemplateId: string | null;

  showBeforeOnMap: boolean;

  // Actions
  initProposal: (streetName: string, location: StreetLocation) => void;
  setRoadPath: (path: Array<{ lat: number; lng: number }>, bearing: number) => void;
  selectPreset: (preset: BeforePreset) => void;
  applyTransformation: (template: TemplateDefinition) => void;
  toggleMapView: () => void;
  goBack: () => void;
  reset: () => void;
  loadProposal: (proposal: StreetProposal) => void;

  // Computed
  getProposal: () => StreetProposal | null;
}

export const useProposalStore = create<ProposalState>()((set, get) => ({
  step: 'street-selected',
  streetName: '',
  location: null,
  roadPath: [],
  bearing: 0,
  selectedPreset: null,
  beforePresetId: null,
  beforeStreet: null,
  afterStreet: null,
  selectedTemplateId: null,
  showBeforeOnMap: true,

  initProposal: (streetName, location) =>
    set({
      step: 'street-selected',
      streetName,
      location,
      roadPath: [],
      bearing: 0,
      selectedPreset: null,
      beforePresetId: null,
      beforeStreet: null,
      afterStreet: null,
      selectedTemplateId: null,
      showBeforeOnMap: true,
    }),

  setRoadPath: (path, bearing) =>
    set({ roadPath: path, bearing }),

  selectPreset: (preset) => {
    const now = new Date().toISOString();
    const elements: CrossSectionElement[] = preset.elements.map((el) => ({
      ...el,
      id: crypto.randomUUID(),
    }));

    const beforeStreet: StreetSegment = {
      id: crypto.randomUUID(),
      name: get().streetName,
      totalROWWidth: preset.rowWidth,
      curbToCurbWidth: computeCurbToCurb(elements),
      direction: preset.direction,
      functionalClass: preset.functionalClass,
      elements,
      metadata: { createdAt: now, updatedAt: now },
      location: get().location ?? undefined,
    };

    set({
      step: 'before-selected',
      selectedPreset: preset,
      beforePresetId: preset.id,
      beforeStreet,
      afterStreet: null,
      selectedTemplateId: null,
    });
  },

  applyTransformation: (template) => {
    const { beforeStreet, streetName } = get();
    if (!beforeStreet) return;

    const afterStreet = adaptTemplate(template, beforeStreet.totalROWWidth);
    afterStreet.name = streetName;
    afterStreet.direction = beforeStreet.direction;
    afterStreet.location = beforeStreet.location;

    set({
      step: 'review',
      afterStreet,
      selectedTemplateId: template.id,
      showBeforeOnMap: false,
    });
  },

  toggleMapView: () =>
    set((s) => ({ showBeforeOnMap: !s.showBeforeOnMap })),

  goBack: () => {
    const { step } = get();
    if (step === 'review') {
      set({ step: 'before-selected', afterStreet: null, selectedTemplateId: null, showBeforeOnMap: true });
    } else if (step === 'before-selected') {
      set({ step: 'street-selected', selectedPreset: null, beforeStreet: null });
    }
  },

  reset: () =>
    set({
      step: 'street-selected',
      streetName: '',
      location: null,
      roadPath: [],
      bearing: 0,
      selectedPreset: null,
      beforePresetId: null,
      beforeStreet: null,
      afterStreet: null,
      selectedTemplateId: null,
      showBeforeOnMap: true,
    }),

  loadProposal: (proposal) =>
    set({
      step: 'review',
      streetName: proposal.streetName,
      location: proposal.location,
      roadPath: proposal.roadPath,
      bearing: proposal.bearing,
      selectedPreset: null,
      beforePresetId: proposal.beforePresetId,
      beforeStreet: proposal.beforeStreet,
      afterStreet: proposal.afterStreet,
      selectedTemplateId: proposal.transformationTemplateId,
      showBeforeOnMap: false,
    }),

  getProposal: () => {
    const s = get();
    if (!s.location || !s.beforeStreet || !s.afterStreet || !s.beforePresetId || !s.selectedTemplateId) {
      return null;
    }
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      streetName: s.streetName,
      location: s.location,
      roadPath: s.roadPath,
      bearing: s.bearing,
      beforePresetId: s.beforePresetId,
      beforeStreet: s.beforeStreet,
      afterStreet: s.afterStreet,
      transformationTemplateId: s.selectedTemplateId,
      metadata: { createdAt: now, updatedAt: now },
    };
  },
}));
