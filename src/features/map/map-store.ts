import { create } from 'zustand';

export interface ReportFormLocation {
  lat: number;
  lng: number;
  address: string;
}

export const DEFAULT_MAP_CENTER = { lat: 39.7392, lng: -104.9903 };
export const DEFAULT_MAP_ZOOM = 12;

export interface MapState {
  initialLocationStatus: 'idle' | 'loading' | 'located' | 'fallback' | 'skipped';
  initialLocationLabel: string | null;
  center: { lat: number; lng: number };
  zoom: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid';
  is3D: boolean;
  // Layers
  showHotspots: boolean;
  showDesigns: boolean;
  showHeatmap: boolean;
  showServiceAreas: boolean;
  activeServiceAreaOrgId: string | null;
  // Selected location
  selectedLocation: { lat: number; lng: number; address: string } | null;
  // Context menu
  contextMenuPosition: {
    lat: number;
    lng: number;
    x: number;
    y: number;
  } | null;
  // Lock map interaction during design mode
  lockedToLocation: boolean;
  // Report form
  reportFormOpen: boolean;
  reportFormLocation: ReportFormLocation | null;
  // Actions
  setCenter: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  setMapType: (type: 'roadmap' | 'satellite' | 'hybrid') => void;
  toggle3D: () => void;
  toggleHotspots: () => void;
  toggleDesigns: () => void;
  toggleHeatmap: () => void;
  toggleServiceAreas: () => void;
  setActiveServiceAreaOrgId: (orgId: string | null) => void;
  setSelectedLocation: (location: MapState['selectedLocation']) => void;
  setLockedToLocation: (locked: boolean) => void;
  openContextMenu: (position: MapState['contextMenuPosition']) => void;
  closeContextMenu: () => void;
  openReportForm: (location: ReportFormLocation) => void;
  closeReportForm: () => void;
}

export const useMapStore = create<MapState>()((set) => ({
  // Useful immediately, even when the optional IP lookup is blocked or unavailable.
  center: DEFAULT_MAP_CENTER,
  zoom: DEFAULT_MAP_ZOOM,
  initialLocationStatus: 'idle',
  initialLocationLabel: null,
  mapType: 'roadmap',
  is3D: false,

  showHotspots: true,
  showDesigns: true,
  showHeatmap: false,
  showServiceAreas: false,
  activeServiceAreaOrgId: null,

  selectedLocation: null,
  contextMenuPosition: null,
  lockedToLocation: false,
  reportFormOpen: false,
  reportFormLocation: null,

  setCenter: (center) => set({ center, initialLocationStatus: 'skipped' }),
  setZoom: (zoom) => set({ zoom, initialLocationStatus: 'skipped' }),
  setMapType: (type) => set({ mapType: type }),

  toggle3D: () =>
    set((state) => {
      if (state.is3D) {
        // Exiting 3D: revert to roadmap
        return { is3D: false, mapType: 'roadmap' };
      }
      // Entering 3D: switch to hybrid
      return { is3D: true, mapType: 'hybrid' };
    }),

  toggleHotspots: () =>
    set((state) => ({ showHotspots: !state.showHotspots })),
  toggleDesigns: () =>
    set((state) => ({ showDesigns: !state.showDesigns })),
  toggleHeatmap: () =>
    set((state) => ({ showHeatmap: !state.showHeatmap })),
  toggleServiceAreas: () =>
    set((state) => ({ showServiceAreas: !state.showServiceAreas })),
  setActiveServiceAreaOrgId: (orgId) => set({ activeServiceAreaOrgId: orgId }),

  setSelectedLocation: (location) => set((state) => ({ selectedLocation: location,
    initialLocationStatus: location ? 'skipped' : state.initialLocationStatus })),

  setLockedToLocation: (locked) => set((state) => ({ lockedToLocation: locked,
    initialLocationStatus: locked ? 'skipped' : state.initialLocationStatus })),
  openContextMenu: (position) => set((state) => ({ contextMenuPosition: position,
    initialLocationStatus: position ? 'skipped' : state.initialLocationStatus })),
  closeContextMenu: () => set({ contextMenuPosition: null }),

  openReportForm: (location) =>
    set({ reportFormOpen: true, reportFormLocation: location, initialLocationStatus: 'skipped' }),
  closeReportForm: () =>
    set({ reportFormOpen: false, reportFormLocation: null }),
}));
