import { create } from 'zustand';

export type WorkspaceMode = 'explore' | 'configure' | 'design' | 'propose' | 'propose-intersection';

export interface DesignLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface WorkspaceState {
  mode: WorkspaceMode;
  designLocation: DesignLocation | null;

  // Panel visibility (design mode)
  showElementPanel: boolean;
  showValidationPanel: boolean;
  showStreetViewPip: boolean;
  dockExpanded: boolean;

  // Actions
  enterConfigureMode: (location: DesignLocation) => void;
  enterDesignMode: (location?: DesignLocation) => void;
  enterProposeMode: (location: DesignLocation) => void;
  enterIntersectionMode: (location: DesignLocation) => void;
  exitToExplore: () => void;

  // Panel toggles
  toggleElementPanel: () => void;
  toggleValidationPanel: () => void;
  toggleStreetViewPip: () => void;
  toggleDock: () => void;
  setDockExpanded: (expanded: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  mode: 'explore',
  designLocation: null,

  showElementPanel: true,
  showValidationPanel: true,
  showStreetViewPip: false,
  dockExpanded: true,

  enterConfigureMode: (location) =>
    set({
      mode: 'configure',
      designLocation: location,
    }),

  enterDesignMode: (location) =>
    set((state) => ({
      mode: 'design',
      designLocation: location ?? state.designLocation,
      showElementPanel: true,
      showValidationPanel: true,
      dockExpanded: true,
    })),

  enterProposeMode: (location) =>
    set({
      mode: 'propose',
      designLocation: location,
    }),

  enterIntersectionMode: (location) =>
    set({
      mode: 'propose-intersection',
      designLocation: location,
    }),

  exitToExplore: () =>
    set({
      mode: 'explore',
      showStreetViewPip: false,
    }),

  toggleElementPanel: () =>
    set((state) => ({ showElementPanel: !state.showElementPanel })),
  toggleValidationPanel: () =>
    set((state) => ({ showValidationPanel: !state.showValidationPanel })),
  toggleStreetViewPip: () =>
    set((state) => ({ showStreetViewPip: !state.showStreetViewPip })),
  toggleDock: () =>
    set((state) => ({ dockExpanded: !state.dockExpanded })),
  setDockExpanded: (expanded) => set({ dockExpanded: expanded }),
}));
