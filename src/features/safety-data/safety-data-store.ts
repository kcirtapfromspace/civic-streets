import { create } from 'zustand';
import type { NormalizedCrash, CrashMode, CrashSeverity, CrashFilters } from '@/lib/types/safety-data';
import { fetchCrashesForViewport, tileCache } from './api';

export interface SafetyDataState {
  crashes: NormalizedCrash[];
  isLoading: boolean;
  error: string | null;
  enabled: boolean;
  showHeatmap: boolean;
  showPoints: boolean;

  filters: CrashFilters;

  // Actions
  setEnabled: (enabled: boolean) => void;
  toggleHeatmap: () => void;
  togglePoints: () => void;
  fetchForBounds: (bounds: { south: number; west: number; north: number; east: number }) => Promise<void>;
  toggleMode: (mode: CrashMode) => void;
  toggleSeverity: (severity: CrashSeverity) => void;
  setDateRange: (start: string, end: string) => void;
  clearDateRange: () => void;
  clearAll: () => void;
}

export const useSafetyDataStore = create<SafetyDataState>()((set, get) => ({
  crashes: [],
  isLoading: false,
  error: null,
  enabled: false,
  showHeatmap: true,
  showPoints: false,

  filters: {
    modes: new Set<CrashMode>(['pedestrian', 'cyclist', 'motorist']),
    severities: new Set<CrashSeverity>(['fatal', 'severe-injury', 'moderate-injury', 'minor']),
    dateRange: null,
  },

  setEnabled: (enabled) => set({ enabled }),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  togglePoints: () => set((s) => ({ showPoints: !s.showPoints })),

  fetchForBounds: async (bounds) => {
    if (!get().enabled) return;

    set({ isLoading: true, error: null });
    try {
      const newCrashes = await fetchCrashesForViewport(bounds);
      set((s) => {
        // Deduplicate by id
        const existingIds = new Set(s.crashes.map((c) => c.id));
        const unique = newCrashes.filter((c) => !existingIds.has(c.id));
        return { crashes: [...s.crashes, ...unique], isLoading: false };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load crash data', isLoading: false });
    }
  },

  toggleMode: (mode) =>
    set((s) => {
      const modes = new Set(s.filters.modes);
      if (modes.has(mode)) modes.delete(mode);
      else modes.add(mode);
      return { filters: { ...s.filters, modes } };
    }),

  toggleSeverity: (severity) =>
    set((s) => {
      const severities = new Set(s.filters.severities);
      if (severities.has(severity)) severities.delete(severity);
      else severities.add(severity);
      return { filters: { ...s.filters, severities } };
    }),

  setDateRange: (start, end) =>
    set((s) => ({ filters: { ...s.filters, dateRange: { start, end } } })),

  clearDateRange: () =>
    set((s) => ({ filters: { ...s.filters, dateRange: null } })),

  clearAll: () => {
    tileCache.clear();
    set({
      crashes: [],
      isLoading: false,
      error: null,
    });
  },
}));
