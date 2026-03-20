import { create } from 'zustand';
import type { HotspotCategory, HotspotStatus } from '@/lib/types/community';

export interface FeedFilter {
  category?: HotspotCategory;
  status?: HotspotStatus;
  sort: 'votes' | 'newest' | 'nearest';
}

export interface CommunityState {
  // Feed state
  feedFilter: FeedFilter;
  searchQuery: string;
  // Active hotspot/design being viewed
  activeHotspotId: string | null;
  activeDesignId: string | null;
  // Save design modal
  isSaveDesignOpen: boolean;
  // Actions
  setFeedFilter: (filter: Partial<FeedFilter>) => void;
  setSearchQuery: (query: string) => void;
  setActiveHotspot: (id: string | null) => void;
  setActiveDesign: (id: string | null) => void;
  openSaveDesign: () => void;
  closeSaveDesign: () => void;
}

export const useCommunityStore = create<CommunityState>()((set) => ({
  feedFilter: { sort: 'votes' },
  searchQuery: '',
  activeHotspotId: null,
  activeDesignId: null,
  isSaveDesignOpen: false,

  setFeedFilter: (filter) =>
    set((state) => ({ feedFilter: { ...state.feedFilter, ...filter } })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveHotspot: (id) => set({ activeHotspotId: id }),

  setActiveDesign: (id) => set({ activeDesignId: id }),

  openSaveDesign: () => set({ isSaveDesignOpen: true }),

  closeSaveDesign: () => set({ isSaveDesignOpen: false }),
}));
