import { create } from 'zustand';
import type { NormalizedCrash, CrashMode, CrashSeverity, CrashFilters, CrashBounds, CrashCoverage, CrashSourceResult } from '@/lib/types/safety-data';
import { fetchCrashesForViewport, crashCache } from './api';

export interface SafetyDataState {
  crashes: NormalizedCrash[];
  sources: CrashSourceResult[];
  coverage: CrashCoverage | null;
  lastBounds: CrashBounds | null;
  isLoading: boolean;
  error: string | null;
  enabled: boolean;
  showHeatmap: boolean;
  showPoints: boolean;
  filters: CrashFilters;
  setEnabled: (enabled: boolean) => void;
  toggleHeatmap: () => void;
  togglePoints: () => void;
  fetchForBounds: (bounds: CrashBounds) => Promise<void>;
  retry: () => Promise<void>;
  resetViewport: () => void;
  toggleMode: (mode: CrashMode) => void;
  toggleSeverity: (severity: CrashSeverity) => void;
  setDateRange: (start: string, end: string) => void;
  clearDateRange: () => void;
  clearAll: () => void;
}

// A slower response for an old viewport/date selection must never replace the
// user's current view, including after disabling the layer or zooming out.
let requestVersion = 0;
const emptyViewport = { crashes: [], sources: [], coverage: null, lastBounds: null, isLoading: false, error: null };

export const useSafetyDataStore = create<SafetyDataState>()((set, get) => ({
  ...emptyViewport,
  enabled: false, showHeatmap: true, showPoints: false,
  filters: {
    modes: new Set<CrashMode>(['pedestrian', 'cyclist', 'motorist']),
    severities: new Set<CrashSeverity>(['fatal', 'severe-injury', 'moderate-injury', 'minor', 'unknown']),
    dateRange: null,
  },
  setEnabled: (enabled) => {
    if (!enabled) requestVersion++;
    set(enabled ? { enabled } : { ...emptyViewport, enabled });
  },
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  togglePoints: () => set((s) => ({ showPoints: !s.showPoints })),
  fetchForBounds: async (bounds) => {
    if (!get().enabled) return;
    const version = ++requestVersion;
    const dateRange = get().filters.dateRange;
    set({ ...emptyViewport, lastBounds: bounds, isLoading: true });
    try {
      const result = await fetchCrashesForViewport(bounds, dateRange);
      if (version !== requestVersion || !get().enabled) return;
      set({ ...result, isLoading: false });
    } catch (error) {
      if (version !== requestVersion || !get().enabled) return;
      set({ error: error instanceof Error ? error.message : 'Crash data could not be loaded.', isLoading: false });
    }
  },
  retry: async () => {
    const bounds = get().lastBounds;
    if (bounds) { crashCache.clear(); await get().fetchForBounds(bounds); }
  },
  resetViewport: () => { requestVersion++; set(emptyViewport); },
  toggleMode: (mode) => set((s) => {
    const modes = new Set(s.filters.modes);
    if (modes.has(mode)) modes.delete(mode); else modes.add(mode);
    return { filters: { ...s.filters, modes } };
  }),
  toggleSeverity: (severity) => set((s) => {
    const severities = new Set(s.filters.severities);
    if (severities.has(severity)) severities.delete(severity); else severities.add(severity);
    return { filters: { ...s.filters, severities } };
  }),
  setDateRange: (start, end) => {
    set((s) => ({ filters: { ...s.filters, dateRange: { start, end } } }));
    const bounds = get().lastBounds;
    if (bounds) void get().fetchForBounds(bounds);
  },
  clearDateRange: () => {
    set((s) => ({ filters: { ...s.filters, dateRange: null } }));
    const bounds = get().lastBounds;
    if (bounds) void get().fetchForBounds(bounds);
  },
  clearAll: () => { requestVersion++; crashCache.clear(); set(emptyViewport); },
}));
