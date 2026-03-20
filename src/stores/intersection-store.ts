import { create } from 'zustand';
import type { IntersectionConditions, CrashSummary, IntersectionProposal } from '@/lib/types/intersection';
import type { NormalizedCrash } from '@/lib/types/safety-data';
import { filterNearbyCrashes, summarizeCrashes } from '@/features/intersection/suggestion-engine';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';

export type IntersectionStep = 'conditions' | 'improvements' | 'review';

export interface IntersectionProposalState {
  step: IntersectionStep;
  intersectionName: string;
  center: { lat: number; lng: number } | null;
  location: { lat: number; lng: number; address: string } | null;

  conditions: IntersectionConditions | null;
  selectedImprovements: string[];
  nearbyCrashes: NormalizedCrash[];
  crashSummary: CrashSummary | null;

  // Actions
  initIntersection: (name: string, center: { lat: number; lng: number }, location: { lat: number; lng: number; address: string }) => void;
  selectConditions: (conditions: IntersectionConditions) => void;
  toggleImprovement: (id: string) => void;
  advanceToReview: () => void;
  goBack: () => void;
  reset: () => void;
  getProposal: () => IntersectionProposal | null;
}

export const useIntersectionStore = create<IntersectionProposalState>()((set, get) => ({
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
    const nearby = filterNearbyCrashes(allCrashes, center);
    const summary = summarizeCrashes(nearby);

    set({
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
      id: crypto.randomUUID(),
      intersectionName: s.intersectionName,
      location: s.location,
      center: s.center,
      conditions: s.conditions,
      selectedImprovements: s.selectedImprovements,
      nearbyCrashSummary: s.crashSummary ?? summarizeCrashes(s.nearbyCrashes),
      metadata: { createdAt: now, updatedAt: now },
    };
  },
}));
