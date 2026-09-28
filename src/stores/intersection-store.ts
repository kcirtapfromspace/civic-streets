import { create } from 'zustand';
import { useWorkDraftsStore, type IntersectionWork } from './work-drafts-store';
import type { DiscussionBriefContext } from '@/lib/types';
import type { IntersectionConditions, CrashSummary, IntersectionProposal } from '@/lib/types/intersection';
import type { NormalizedCrash } from '@/lib/types/safety-data';
import { filterNearbyCrashes, summarizeCrashes } from '@/features/intersection/suggestion-engine';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';

export type IntersectionStep = 'conditions' | 'improvements' | 'review';

export interface IntersectionProposalState {
  proposalId: string | null;
  createdAt: string | null;
  briefContext: DiscussionBriefContext;
  step: IntersectionStep;
  intersectionName: string;
  center: { lat: number; lng: number } | null;
  location: { lat: number; lng: number; address: string } | null;

  conditions: IntersectionConditions | null;
  selectedImprovements: string[];
  nearbyCrashes: NormalizedCrash[];
  crashSummary: CrashSummary | null;

  // Actions
  initIntersection: (name: string, center: { lat: number; lng: number } | null, location: { lat: number; lng: number; address: string } | null) => void;
  setBriefContext: (context: Partial<DiscussionBriefContext>) => void;
  getWork: () => IntersectionWork | null;
  saveWork: () => boolean;
  loadWork: (work: IntersectionWork) => void;
  selectConditions: (conditions: IntersectionConditions) => void;
  toggleImprovement: (id: string) => void;
  advanceToReview: () => void;
  goBack: () => void;
  reset: () => void;
  getProposal: () => IntersectionProposal | null;
}

export const useIntersectionStore = create<IntersectionProposalState>()((set, get) => ({
  proposalId: null,
  createdAt: null,
  briefContext: { concern: '', desiredOutcome: '', requestedNextStep: '', dimensionBasis: 'assumed', dimensionSource: '' },
  step: 'conditions',
  intersectionName: '',
  center: null,
  location: null,
  conditions: null,
  selectedImprovements: [],
  nearbyCrashes: [],
  crashSummary: null,

  initIntersection: (name, center, location) => {
    const allCrashes = useSafetyDataStore.getState().crashes;
    const nearby = center ? filterNearbyCrashes(allCrashes, center) : [];
    const summary = summarizeCrashes(nearby);

    set({
      proposalId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      briefContext: { concern: '', desiredOutcome: '', requestedNextStep: '', dimensionBasis: 'assumed', dimensionSource: '' },
      step: 'conditions',
      intersectionName: name,
      center,
      location,
      conditions: null,
      selectedImprovements: [],
      nearbyCrashes: nearby,
      crashSummary: summary,
    });
  },

  setBriefContext: (context) => set((s) => ({ briefContext: { ...s.briefContext, ...context } })),
  getWork: () => {
    const s = get();
    if (!s.proposalId || !s.createdAt) return null;
    return { kind: 'intersection', id: s.proposalId, name: s.intersectionName, location: s.location, createdAt: s.createdAt, updatedAt: new Date().toISOString(), briefContext: s.briefContext, step: s.step, center: s.center, conditions: s.conditions, selectedImprovements: s.selectedImprovements, crashSummary: s.crashSummary };
  },
  saveWork: () => { const work = get().getWork(); return !work || useWorkDraftsStore.getState().save(work); },
  loadWork: (work) => set({ proposalId: work.id, createdAt: work.createdAt, briefContext: work.briefContext, step: work.step, intersectionName: work.name, center: work.center, location: work.location, conditions: work.conditions, selectedImprovements: [...work.selectedImprovements], crashSummary: work.crashSummary, nearbyCrashes: [] }),

  selectConditions: (conditions) =>
    set({ step: 'improvements', conditions }),

  toggleImprovement: (id) =>
    set((s) => ({
      selectedImprovements: s.selectedImprovements.includes(id)
        ? s.selectedImprovements.filter((i) => i !== id)
        : [...s.selectedImprovements, id],
    })),

  advanceToReview: () =>
    set({ step: 'review' }),

  goBack: () => {
    const { step } = get();
    if (step === 'review') set({ step: 'improvements' });
    else if (step === 'improvements') set({ step: 'conditions', conditions: null, selectedImprovements: [] });
  },

  reset: () =>
    set({
      proposalId: null,
      createdAt: null,
      briefContext: { concern: '', desiredOutcome: '', requestedNextStep: '', dimensionBasis: 'assumed', dimensionSource: '' },
      step: 'conditions',
      intersectionName: '',
      center: null,
      location: null,
      conditions: null,
      selectedImprovements: [],
      nearbyCrashes: [],
      crashSummary: null,
    }),

  getProposal: () => {
    const s = get();
    if (!s.location || !s.center || !s.conditions) return null;
    const now = new Date().toISOString();
    return {
      id: s.proposalId ?? crypto.randomUUID(),
      intersectionName: s.intersectionName,
      location: s.location,
      center: s.center,
      conditions: s.conditions,
      selectedImprovements: s.selectedImprovements,
      nearbyCrashSummary: s.crashSummary ?? summarizeCrashes(s.nearbyCrashes),
      metadata: { createdAt: s.createdAt ?? now, updatedAt: now },
    };
  },
}));

useIntersectionStore.subscribe((state) => { state.saveWork(); });
