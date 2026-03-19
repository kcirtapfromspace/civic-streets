// Zustand store skeleton — WS4 owns the implementation
import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  StreetSegment,
  CrossSectionElement,
  ValidationResult,
  TemplateDefinition,
} from '@/lib/types';

export interface StreetState {
  // Current street being edited
  currentStreet: StreetSegment | null;
  // Optional "before" street for comparison
  beforeStreet: StreetSegment | null;
  // Validation results from standards engine
  validationResults: ValidationResult[];
  // Currently selected element ID
  selectedElementId: string | null;
  // UI state
  isTemplateGalleryOpen: boolean;
  isExporting: boolean;

  // Street actions
  setStreet: (street: StreetSegment) => void;
  setBeforeStreet: (street: StreetSegment | null) => void;
  updateStreetName: (name: string) => void;
  setROWWidth: (width: number) => void;
  setDirection: (direction: StreetSegment['direction']) => void;
  setFunctionalClass: (fc: StreetSegment['functionalClass']) => void;

  // Element actions
  addElement: (element: Omit<CrossSectionElement, 'id'>) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<CrossSectionElement>) => void;
  reorderElements: (fromIndex: number, toIndex: number) => void;
  selectElement: (id: string | null) => void;

  // Validation
  setValidationResults: (results: ValidationResult[]) => void;

  // Templates
  applyTemplate: (template: TemplateDefinition, rowWidth: number) => void;
  openTemplateGallery: () => void;
  closeTemplateGallery: () => void;

  // Export
  setExporting: (exporting: boolean) => void;
}

// Placeholder — WS4 will implement the full store
export const useStreetStore = create<StreetState>()(
  temporal(
    (set, get) => ({
      currentStreet: null,
      beforeStreet: null,
      validationResults: [],
      selectedElementId: null,
      isTemplateGalleryOpen: false,
      isExporting: false,

      setStreet: (street) => set({ currentStreet: street }),
      setBeforeStreet: (street) => set({ beforeStreet: street }),
      updateStreetName: (name) => {
        const current = get().currentStreet;
        if (current) set({ currentStreet: { ...current, name } });
      },
      setROWWidth: (width) => {
        const current = get().currentStreet;
        if (current) set({ currentStreet: { ...current, totalROWWidth: width } });
      },
      setDirection: (direction) => {
        const current = get().currentStreet;
        if (current) set({ currentStreet: { ...current, direction } });
      },
      setFunctionalClass: (fc) => {
        const current = get().currentStreet;
        if (current) set({ currentStreet: { ...current, functionalClass: fc } });
      },

      addElement: (_element) => { /* WS4 implements */ },
      removeElement: (_id) => { /* WS4 implements */ },
      updateElement: (_id, _updates) => { /* WS4 implements */ },
      reorderElements: (_from, _to) => { /* WS4 implements */ },
      selectElement: (id) => set({ selectedElementId: id }),

      setValidationResults: (results) => set({ validationResults: results }),

      applyTemplate: (_template, _rowWidth) => { /* WS4 implements */ },
      openTemplateGallery: () => set({ isTemplateGalleryOpen: true }),
      closeTemplateGallery: () => set({ isTemplateGalleryOpen: false }),

      setExporting: (exporting) => set({ isExporting: exporting }),
    })
  )
);
