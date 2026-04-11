import { create } from 'zustand';

export interface ReportFormLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface MapState {
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
  // Default center: US center
  center: { lat: 39.8283, lng: -98.5795 },
  zoom: 4,
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

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
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

  setSelectedLocation: (location) => set({ selectedLocation: location }),

  setLockedToLocation: (locked) => set({ lockedToLocation: locked }),
  openContextMenu: (position) => set({ contextMenuPosition: position }),
  closeContextMenu: () => set({ contextMenuPosition: null }),

  openReportForm: (location) =>
    set({ reportFormOpen: true, reportFormLocation: location }),
  closeReportForm: () =>
    set({ reportFormOpen: false, reportFormLocation: null }),
}));
