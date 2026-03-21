import { create } from 'zustand';

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ExplorerState {
  boundsFilter: Bounds | null;
  polygonFilter: [number, number][] | null;
  showSearchButton: boolean;
  isDrawing: boolean;
  setBoundsFilter: (bounds: Bounds | null) => void;
  setPolygonFilter: (polygon: [number, number][] | null) => void;
  setShowSearchButton: (show: boolean) => void;
  setIsDrawing: (drawing: boolean) => void;
  clearSpatialFilters: () => void;
}

export const useExplorerStore = create<ExplorerState>()((set) => ({
  boundsFilter: null,
  polygonFilter: null,
  showSearchButton: false,
  isDrawing: false,

  setBoundsFilter: (bounds) => set({ boundsFilter: bounds, showSearchButton: false }),
  setPolygonFilter: (polygon) => set({ polygonFilter: polygon }),
  setShowSearchButton: (show) => set({ showSearchButton: show }),
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  clearSpatialFilters: () =>
    set({ boundsFilter: null, polygonFilter: null, showSearchButton: false }),
}));
