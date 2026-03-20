import { create } from 'zustand';
import { useProposalStore } from './proposal-store';
import { useWorkspaceStore } from './workspace-store';

export type DrawingTool = 'select' | 'road' | 'intersection' | 'newroad';

type LatLng = { lat: number; lng: number };

export interface DrawingState {
  activeTool: DrawingTool;
  isDragging: boolean;
  selectedPath: LatLng[] | null;
  isSnapping: boolean;
  streetName: string | null;

  setActiveTool: (tool: DrawingTool) => void;
  setIsDragging: (d: boolean) => void;
  setSelectedPath: (path: LatLng[] | null) => void;
  setIsSnapping: (s: boolean) => void;
  setStreetName: (name: string | null) => void;
  clear: () => void;
  commitToProposal: () => void;
}

function bearingBetween(from: LatLng, to: LatLng): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const useDrawingStore = create<DrawingState>()((set, get) => ({
  activeTool: 'select',
  isDragging: false,
  selectedPath: null,
  isSnapping: false,
  streetName: null,

  setActiveTool: (tool) =>
    set({ activeTool: tool, selectedPath: null, isDragging: false, isSnapping: false, streetName: null }),

  setIsDragging: (d) => set({ isDragging: d }),

  setSelectedPath: (path) => set({ selectedPath: path, isDragging: false }),

  setIsSnapping: (s) => set({ isSnapping: s }),

  setStreetName: (name) => set({ streetName: name }),

  clear: () => set({ selectedPath: null, isDragging: false, isSnapping: false, streetName: null }),

  commitToProposal: () => {
    const { selectedPath, activeTool, streetName } = get();
    if (!selectedPath || selectedPath.length < 2) return;

    const { initProposal, setRoadPath } = useProposalStore.getState();
    const { enterProposeMode } = useWorkspaceStore.getState();

    const first = selectedPath[0];
    const last = selectedPath[selectedPath.length - 1];
    const bearing = bearingBetween(first, last);

    const mid = selectedPath[Math.floor(selectedPath.length / 2)];
    const label = activeTool === 'newroad'
      ? 'New Road'
      : streetName ?? 'Selected Road';
    const location = { lat: mid.lat, lng: mid.lng, address: label };

    initProposal(label, location);
    setRoadPath(selectedPath, bearing);
    enterProposeMode(location);

    set({ activeTool: 'select', selectedPath: null, streetName: null });
  },
}));
