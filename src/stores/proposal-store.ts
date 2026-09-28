import { create } from 'zustand';
import type {
  StreetSegment,
  StreetLocation,
  BeforePreset,
  StreetProposal,
  TemplateDefinition,
  CrossSectionElement,
  ElementType,
  DiscussionBriefContext,
  ObservationSnapshot,
} from '@/lib/types';
import { adaptTemplate } from '@/lib/templates/adapter';
import { useWorkDraftsStore, type StreetWork, type StreetWorkStep } from './work-drafts-store';
import { observationBriefContext } from '@/features/community/observation-brief-store';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';

export type ProposalStep = StreetWorkStep;

function emptyBriefContext(): DiscussionBriefContext {
  return { concern: '', desiredOutcome: '', requestedNextStep: '', dimensionBasis: 'assumed', dimensionSource: '' };
}

function copyBriefContext(context: DiscussionBriefContext): DiscussionBriefContext {
  return { ...context, ...(context.observation ? { observation: { ...context.observation, photoUrls: [...context.observation.photoUrls] } } : {}) };
}

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
  proposalId: string | null;
  createdAt: string | null;
  step: ProposalStep;
  streetName: string;
  location: StreetLocation | null;
  roadPath: Array<{ lat: number; lng: number }>;
  bearing: number;
  briefContext: DiscussionBriefContext;

  selectedPreset: BeforePreset | null;
  beforePresetId: string | null;
  beforeStreet: StreetSegment | null;
  afterStreet: StreetSegment | null;
  selectedTemplateId: string | null;

  showBeforeOnMap: boolean;

  // Actions
  initProposal: (streetName: string, location: StreetLocation | null, observation?: ObservationSnapshot) => void;
  initConcern: (locationDescription: string) => void;
  setBriefContext: (context: Partial<DiscussionBriefContext>) => void;
  continueToExplore: () => void;
  prepareBrief: () => void;
  getWork: () => StreetWork | null;
  saveWork: () => boolean;
  loadWork: (work: StreetWork) => void;
  setRoadPath: (path: Array<{ lat: number; lng: number }>, bearing: number) => void;
  selectPreset: (preset: BeforePreset) => void;
  applyTransformation: (template: TemplateDefinition) => void;
  toggleMapView: () => void;
  goBack: () => void;
  reset: () => void;
  loadProposal: (proposal: StreetProposal) => void;
  tryLoadProposal: (proposal: StreetProposal) => boolean;
  hasUnsavedChanges: () => boolean;

  // Computed
  getProposal: () => StreetProposal | null;
}

export const useProposalStore = create<ProposalState>()((set, get) => ({
  proposalId: null,
  createdAt: null,
  step: 'concern',
  streetName: '',
  location: null,
  roadPath: [],
  bearing: 0,
  briefContext: emptyBriefContext(),
  selectedPreset: null,
  beforePresetId: null,
  beforeStreet: null,
  afterStreet: null,
  selectedTemplateId: null,
  showBeforeOnMap: true,

  initProposal: (streetName, location, observation) =>
    set({
      proposalId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      step: 'concern',
      streetName,
      location: location ? { ...location } : null,
      roadPath: [],
      bearing: 0,
      briefContext: copyBriefContext({ ...emptyBriefContext(), ...(observation ? observationBriefContext(observation, observation.source) : {}) }),
      selectedPreset: null,
      beforePresetId: null,
      beforeStreet: null,
      afterStreet: null,
      selectedTemplateId: null,
      showBeforeOnMap: true,
    }),

  initConcern: (locationDescription) => get().initProposal(locationDescription, null),

  setBriefContext: (context) => set((state) => ({ briefContext: copyBriefContext({ ...state.briefContext, ...context }) })),
  continueToExplore: () => set({ step: 'street-selected' }),
  prepareBrief: () => set({ step: 'brief' }),
  getWork: () => {
    const s = get();
    if (!s.proposalId || !s.createdAt) return null;
    return { kind: 'street', id: s.proposalId, name: s.streetName, location: s.location, createdAt: s.createdAt, updatedAt: new Date().toISOString(), step: s.step, roadPath: s.roadPath, bearing: s.bearing, briefContext: s.briefContext, beforePresetId: s.beforePresetId, beforeStreet: s.beforeStreet, afterStreet: s.afterStreet, selectedTemplateId: s.selectedTemplateId, showBeforeOnMap: s.showBeforeOnMap };
  },
  saveWork: () => { const work = get().getWork(); return !work || useWorkDraftsStore.getState().save(work); },
  loadWork: (work) => set({ proposalId: work.id, createdAt: work.createdAt, streetName: work.name, location: work.location, step: work.step, roadPath: work.roadPath, bearing: work.bearing, briefContext: copyBriefContext(work.briefContext), beforePresetId: work.beforePresetId, beforeStreet: work.beforeStreet, afterStreet: work.afterStreet, selectedTemplateId: work.selectedTemplateId, showBeforeOnMap: work.showBeforeOnMap, selectedPreset: BEFORE_PRESETS.find((preset) => preset.id === work.beforePresetId) ?? null }),

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
      briefContext: { ...get().briefContext, dimensionBasis: 'assumed', dimensionSource: '' },
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
    if (step === 'brief') {
      set({ step: 'concern' });
    } else if (step === 'review') {
      set({ step: 'before-selected', afterStreet: null, selectedTemplateId: null, showBeforeOnMap: true });
    } else if (step === 'before-selected') {
      set({ step: 'street-selected', selectedPreset: null, beforeStreet: null });
    } else if (step === 'street-selected') {
      set({ step: 'concern' });
    }
  },

  reset: () =>
    set({
      proposalId: null,
      createdAt: null,
      step: 'concern',
      streetName: '',
      location: null,
      roadPath: [],
      bearing: 0,
      briefContext: emptyBriefContext(),
      selectedPreset: null,
      beforePresetId: null,
      beforeStreet: null,
      afterStreet: null,
      selectedTemplateId: null,
      showBeforeOnMap: true,
    }),

  loadProposal: (proposal) =>
    set({
      proposalId: proposal.id,
      createdAt: proposal.metadata.createdAt,
      step: 'review',
      streetName: proposal.streetName,
      location: proposal.location,
      roadPath: proposal.roadPath,
      bearing: proposal.bearing,
      briefContext: copyBriefContext(proposal.briefContext ?? emptyBriefContext()),
      selectedPreset: null,
      beforePresetId: proposal.beforePresetId,
      beforeStreet: proposal.beforeStreet,
      afterStreet: proposal.afterStreet,
      selectedTemplateId: proposal.transformationTemplateId,
      showBeforeOnMap: false,
    }),

  hasUnsavedChanges: () => {
    const work = get().getWork();
    if (!work) return false;
    const saved = useWorkDraftsStore.getState().drafts[work.id];
    return !saved || JSON.stringify({ ...work, updatedAt: undefined }) !== JSON.stringify({ ...saved, updatedAt: undefined, archived: undefined, followUp: undefined });
  },

  tryLoadProposal: (proposal) => {
    if (get().hasUnsavedChanges()) return false;
    get().loadProposal(proposal);
    return true;
  },

  getProposal: () => {
    const s = get();
    if (!s.location || !s.beforeStreet || !s.afterStreet || !s.beforePresetId || !s.selectedTemplateId) {
      return null;
    }
    const now = new Date().toISOString();
    return {
      id: s.proposalId ?? s.afterStreet.id,
      streetName: s.streetName,
      location: s.location,
      roadPath: s.roadPath,
      bearing: s.bearing,
      briefContext: copyBriefContext(s.briefContext),
      beforePresetId: s.beforePresetId,
      beforeStreet: s.beforeStreet,
      afterStreet: s.afterStreet,
      transformationTemplateId: s.selectedTemplateId,
      metadata: { createdAt: s.createdAt ?? s.beforeStreet.metadata.createdAt, updatedAt: now },
    };
  },
}));

// Save each user edit, including the concern before any geometry exists.
useProposalStore.subscribe((state) => { state.saveWork(); });
