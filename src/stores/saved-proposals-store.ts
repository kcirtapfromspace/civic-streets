import { create } from 'zustand';
import type { StreetProposal } from '@/lib/types';

export interface SavedProposalsState {
  proposals: Record<string, StreetProposal>;

  saveProposal: (proposal: StreetProposal) => void;
  removeProposal: (id: string) => void;
  getProposal: (id: string) => StreetProposal | undefined;
}

export const useSavedProposalsStore = create<SavedProposalsState>()((set, get) => ({
  proposals: {},

  saveProposal: (proposal) =>
    set((s) => ({
      proposals: { ...s.proposals, [proposal.id]: proposal },
    })),

  removeProposal: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.proposals;
      return { proposals: rest };
    }),

  getProposal: (id) => get().proposals[id],
}));
