import { create } from 'zustand';
import type { HotspotCategory, HotspotStatus } from '@/lib/types/community';

export interface FeedFilter {
  category?: HotspotCategory;
  status?: HotspotStatus;
  sort: 'votes' | 'newest' | 'nearest';
}

export interface SaveDesignData {
  title: string;
  address: string;
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
  saveDesignData: SaveDesignData | null;
  // Actions
  setFeedFilter: (filter: Partial<FeedFilter>) => void;
  setSearchQuery: (query: string) => void;
  setActiveHotspot: (id: string | null) => void;
  setActiveDesign: (id: string | null) => void;
  openSaveDesign: (data?: SaveDesignData) => void;
  closeSaveDesign: () => void;
}

export const useCommunityStore = create<CommunityState>()((set) => ({
  feedFilter: { sort: 'votes' },
  searchQuery: '',
  activeHotspotId: null,
  activeDesignId: null,
  isSaveDesignOpen: false,
  saveDesignData: null,

  setFeedFilter: (filter) =>
    set((state) => ({ feedFilter: { ...state.feedFilter, ...filter } })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveHotspot: (id) => set({ activeHotspotId: id }),

  setActiveDesign: (id) => set({ activeDesignId: id }),

  openSaveDesign: (data) =>
    set({ isSaveDesignOpen: true, saveDesignData: data ?? null }),

  closeSaveDesign: () =>
    set({ isSaveDesignOpen: false, saveDesignData: null }),
}));
