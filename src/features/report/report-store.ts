// Zustand store for the report wizard state

import { create } from 'zustand';
import type { RepInfo } from '@/lib/types';

export type ReportStep = 1 | 2 | 3 | 4;

export interface ReportState {
  step: ReportStep;
  // Context
  designId: string | null;
  hotspotId: string | null;
  address: string;
  // Reps
  selectedReps: RepInfo[];
  // Message
  subject: string;
  body: string;
  includePdf: boolean;
  // Actions
  setStep: (step: ReportStep) => void;
  setContext: (
    designId: string | null,
    hotspotId: string | null,
    address: string,
  ) => void;
  selectRep: (rep: RepInfo) => void;
  deselectRep: (repName: string) => void;
  setSubject: (subject: string) => void;
  setBody: (body: string) => void;
  togglePdf: () => void;
  reset: () => void;
}

const initialState = {
  step: 1 as ReportStep,
  designId: null as string | null,
  hotspotId: null as string | null,
  address: '',
  selectedReps: [] as RepInfo[],
  subject: '',
  body: '',
  includePdf: false,
};

export const useReportStore = create<ReportState>((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setContext: (designId, hotspotId, address) =>
    set({ designId, hotspotId, address }),

  selectRep: (rep) =>
    set((state) => {
      // Prevent duplicates by name
      if (state.selectedReps.some((r) => r.name === rep.name)) {
        return state;
      }
      return { selectedReps: [...state.selectedReps, rep] };
    }),

  deselectRep: (repName) =>
    set((state) => ({
      selectedReps: state.selectedReps.filter((r) => r.name !== repName),
    })),

  setSubject: (subject) => set({ subject }),

  setBody: (body) => set({ body }),

  togglePdf: () => set((state) => ({ includePdf: !state.includePdf })),

  reset: () => set({ ...initialState }),
}));
