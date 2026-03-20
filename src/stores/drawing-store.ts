import { create } from 'zustand';
import { useProposalStore } from './proposal-store';
import { useWorkspaceStore } from './workspace-store';

export type DrawingMode = 'cursor' | 'line' | 'circle' | 'freehand';

export interface DrawnGeometry {
  id: string;
  mode: DrawingMode;
  /** Raw user-drawn coordinates */
  rawCoords: Array<{ lat: number; lng: number }>;
  /** Road-snapped coordinates (null if not yet snapped or freehand) */
  snappedCoords: Array<{ lat: number; lng: number }> | null;
  /** For circle mode: center + radius in meters */
  center?: { lat: number; lng: number };
  radiusMeters?: number;
}

export interface DrawingState {
  activeMode: DrawingMode;
  drawnGeometries: DrawnGeometry[];
  isSnapping: boolean;

  setActiveMode: (mode: DrawingMode) => void;
  addGeometry: (geometry: DrawnGeometry) => void;
  updateGeometrySnapped: (id: string, snappedCoords: Array<{ lat: number; lng: number }>) => void;
  setIsSnapping: (snapping: boolean) => void;
  clearGeometries: () => void;
  removeGeometry: (id: string) => void;

  /** Bridge: push the latest drawn geometry into proposal-store and enter propose mode */
  commitToProposal: () => void;
}

export const useDrawingStore = create<DrawingState>()((set, get) => ({
  activeMode: 'cursor',
  drawnGeometries: [],
  isSnapping: false,

  setActiveMode: (mode) => set({ activeMode: mode }),

  addGeometry: (geometry) =>
    set((s) => ({ drawnGeometries: [...s.drawnGeometries, geometry] })),

  updateGeometrySnapped: (id, snappedCoords) =>
    set((s) => ({
      drawnGeometries: s.drawnGeometries.map((g) =>
        g.id === id ? { ...g, snappedCoords } : g,
      ),
    })),

  setIsSnapping: (snapping) => set({ isSnapping: snapping }),

  clearGeometries: () => set({ drawnGeometries: [] }),

  removeGeometry: (id) =>
    set((s) => ({
      drawnGeometries: s.drawnGeometries.filter((g) => g.id !== id),
    })),

  commitToProposal: () => {
    const { drawnGeometries } = get();
    const latest = drawnGeometries[drawnGeometries.length - 1];
    if (!latest) return;

    const path = latest.snappedCoords ?? latest.rawCoords;
    if (path.length < 2) return;

    const { initProposal, setRoadPath } = useProposalStore.getState();
    const { enterProposeMode } = useWorkspaceStore.getState();

    // Compute bearing from first to last point
    const first = path[0];
    const last = path[path.length - 1];
    const dLng = ((last.lng - first.lng) * Math.PI) / 180;
    const lat1 = (first.lat * Math.PI) / 180;
    const lat2 = (last.lat * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    // Use midpoint as location
    const mid = path[Math.floor(path.length / 2)];
    const location = { lat: mid.lat, lng: mid.lng, address: 'Drawn street' };

    initProposal('Drawn Street', location);
    setRoadPath(path, bearing);
    enterProposeMode(location);

    // Switch back to cursor mode
    set({ activeMode: 'cursor' });
  },
}));
