import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  StreetSegment,
  StreetLocation,
  CrossSectionElement,
  ValidationResult,
  TemplateDefinition,
  ElementType,
  FunctionalClass,
  StreetDirection,
} from '@/lib/types';
import { DEFAULT_CONSTRAINTS, DEFAULT_WIDTHS } from '@/lib/constants';
import { adaptTemplate } from '@/lib/templates/adapter';

// Element types that live between the curbs (for curbToCurbWidth calculation)
const CURB_TO_CURB_TYPES: Set<ElementType> = new Set([
  'bike-lane',
  'bike-lane-protected',
  'buffer',
  'parking-lane',
  'travel-lane',
  'turn-lane',
  'transit-lane',
  'median',
]);

function computeCurbToCurb(elements: CrossSectionElement[]): number {
  return parseFloat(
    elements
      .filter((el) => CURB_TO_CURB_TYPES.has(el.type))
      .reduce((sum, el) => sum + el.width, 0)
      .toFixed(2),
  );
}

function updatedAt(): string {
  return new Date().toISOString();
}

export interface StreetState {
  // Current street being edited
  currentStreet: StreetSegment | null;
  sourceDesignId: string | null;
  workId: string | null;
  // Optional "before" street for comparison
  beforeStreet: StreetSegment | null;
  // Validation results from standards engine
  validationResults: ValidationResult[];
  validationStatus: 'idle' | 'pending' | 'complete' | 'error';
  // Currently selected element ID
  selectedElementId: string | null;
  // UI state
  isTemplateGalleryOpen: boolean;
  isExporting: boolean;
  showBeforeAfter: boolean;

  // Street actions
  setStreet: (street: StreetSegment) => void;
  setBeforeStreet: (street: StreetSegment | null) => void;
  updateStreetName: (name: string) => void;
  setROWWidth: (width: number) => void;
  setDirection: (direction: StreetDirection) => void;
  setFunctionalClass: (fc: FunctionalClass) => void;
  createNewStreet: (
    name: string,
    rowWidth: number,
    functionalClass: FunctionalClass,
    direction: StreetDirection,
    location?: StreetLocation,
  ) => void;

  // Element actions
  addElement: (element: Omit<CrossSectionElement, 'id'>) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<CrossSectionElement>) => void;
  reorderElements: (fromIndex: number, toIndex: number) => void;
  selectElement: (id: string | null) => void;

  // Validation
  setValidationResults: (results: ValidationResult[]) => void;
  setValidationStatus: (status: Exclude<StreetState['validationStatus'], 'complete'>) => void;

  // Templates
  applyTemplate: (template: TemplateDefinition, rowWidth: number) => void;
  openTemplateGallery: () => void;
  closeTemplateGallery: () => void;

  // Export
  setExporting: (exporting: boolean) => void;
  toggleBeforeAfter: () => void;
}

export const useStreetStore = create<StreetState>()(
  temporal((set, get) => ({
    currentStreet: null,
    sourceDesignId: null,
    workId: null,
    beforeStreet: null,
    validationResults: [],
    validationStatus: 'idle',
    selectedElementId: null,
    isTemplateGalleryOpen: false,
    isExporting: false,
    showBeforeAfter: false,

    setStreet: (street) =>
      set({
        currentStreet: street,
        sourceDesignId: null,
        workId: street.id,
        validationResults: [],
        validationStatus: 'pending',
        selectedElementId: null,
        showBeforeAfter: false,
      }),

    setBeforeStreet: (street) => set({ beforeStreet: street }),

    updateStreetName: (name) => {
      const current = get().currentStreet;
      if (!current) return;
      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          name,
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
      });
    },

    setROWWidth: (width) => {
      const current = get().currentStreet;
      if (!current) return;
      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          totalROWWidth: width,
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
      });
    },

    setDirection: (direction) => {
      const current = get().currentStreet;
      if (!current) return;
      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          direction,
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
      });
    },

    setFunctionalClass: (fc) => {
      const current = get().currentStreet;
      if (!current) return;
      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          functionalClass: fc,
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
      });
    },

    createNewStreet: (name, rowWidth, functionalClass, direction, location) => {
      const now = new Date().toISOString();
      const elements: CrossSectionElement[] = [
        {
          id: crypto.randomUUID(),
          type: 'sidewalk',
          side: 'left',
          width: DEFAULT_WIDTHS['sidewalk'],
          constraints: DEFAULT_CONSTRAINTS['sidewalk'],
          locked: false,
          label: 'Sidewalk',
        },
        {
          id: crypto.randomUUID(),
          type: 'curb',
          side: 'left',
          width: DEFAULT_WIDTHS['curb'],
          constraints: DEFAULT_CONSTRAINTS['curb'],
          locked: false,
          label: 'Curb',
        },
        {
          id: crypto.randomUUID(),
          type: 'travel-lane',
          side: 'center',
          width: DEFAULT_WIDTHS['travel-lane'],
          constraints: DEFAULT_CONSTRAINTS['travel-lane'],
          locked: false,
          label: 'Travel Lane',
        },
        {
          id: crypto.randomUUID(),
          type: 'curb',
          side: 'right',
          width: DEFAULT_WIDTHS['curb'],
          constraints: DEFAULT_CONSTRAINTS['curb'],
          locked: false,
          label: 'Curb',
        },
        {
          id: crypto.randomUUID(),
          type: 'sidewalk',
          side: 'right',
          width: DEFAULT_WIDTHS['sidewalk'],
          constraints: DEFAULT_CONSTRAINTS['sidewalk'],
          locked: false,
          label: 'Sidewalk',
        },
      ];

      const street: StreetSegment = {
        id: crypto.randomUUID(),
        name,
        totalROWWidth: rowWidth,
        curbToCurbWidth: computeCurbToCurb(elements),
        direction,
        functionalClass,
        elements,
        metadata: { createdAt: now, updatedAt: now },
        ...(location ? { location } : {}),
      };
      set({
        validationStatus: 'pending',
        currentStreet: street,
        workId: street.id,
        beforeStreet: null,
        validationResults: [],
        selectedElementId: null,
      });
    },

    addElement: (element) => {
      const current = get().currentStreet;
      if (!current) return;

      const newElement: CrossSectionElement = {
        ...element,
        id: crypto.randomUUID(),
      };

      const elements = [...current.elements];

      // Insert based on side:
      // left elements go at the start (before center/right),
      // right elements go at the end (after center/left),
      // center elements go in the middle
      if (newElement.side === 'left') {
        // Find the first non-left element
        const firstNonLeft = elements.findIndex((el) => el.side !== 'left');
        if (firstNonLeft === -1) {
          elements.push(newElement);
        } else {
          elements.splice(firstNonLeft, 0, newElement);
        }
      } else if (newElement.side === 'right') {
        // Find the last non-right element
        let lastNonRight = -1;
        for (let i = elements.length - 1; i >= 0; i--) {
          if (elements[i].side !== 'right') {
            lastNonRight = i;
            break;
          }
        }
        elements.splice(lastNonRight + 1, 0, newElement);
      } else {
        // Center: insert in the middle of center elements
        const centerStart = elements.findIndex((el) => el.side === 'center');
        const centerEnd = elements.reduce((last, el, i) => (el.side === 'center' ? i : last), -1);
        if (centerStart === -1) {
          // No center elements — insert after left elements
          const firstRight = elements.findIndex((el) => el.side === 'right');
          if (firstRight === -1) {
            elements.push(newElement);
          } else {
            elements.splice(firstRight, 0, newElement);
          }
        } else {
          elements.splice(centerEnd + 1, 0, newElement);
        }
      }

      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          elements,
          curbToCurbWidth: computeCurbToCurb(elements),
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
      });
    },

    removeElement: (id) => {
      const current = get().currentStreet;
      if (!current) return;

      const elements = current.elements.filter((el) => el.id !== id);
      const selectedId = get().selectedElementId === id ? null : get().selectedElementId;

      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          elements,
          curbToCurbWidth: computeCurbToCurb(elements),
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
        selectedElementId: selectedId,
      });
    },

    updateElement: (id, updates) => {
      const current = get().currentStreet;
      if (!current) return;

      const elements = current.elements.map((el) => (el.id === id ? { ...el, ...updates } : el));

      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          elements,
          curbToCurbWidth: computeCurbToCurb(elements),
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
      });
    },

    reorderElements: (fromIndex, toIndex) => {
      const current = get().currentStreet;
      if (!current) return;

      const elements = [...current.elements];
      if (
        fromIndex < 0 ||
        fromIndex >= elements.length ||
        toIndex < 0 ||
        toIndex >= elements.length
      ) {
        return;
      }

      const [moved] = elements.splice(fromIndex, 1);
      elements.splice(toIndex, 0, moved);

      set({
        validationStatus: 'pending',
        currentStreet: {
          ...current,
          elements,
          metadata: { ...current.metadata, updatedAt: updatedAt() },
        },
      });
    },

    selectElement: (id) => set({ selectedElementId: id }),

    setValidationResults: (results) =>
      set({ validationResults: results, validationStatus: 'complete' }),

    setValidationStatus: (validationStatus) => set({ validationStatus, validationResults: [] }),

    applyTemplate: (template, rowWidth) => {
      const current = get().currentStreet;

      // Save current street as the "before" for comparison
      if (current) {
        set({ beforeStreet: { ...current } });
      }

      // Use WS3 parametric adapter for PROWAG-first width fitting
      const newStreet = adaptTemplate(template, rowWidth);
      // Preserve the user's street name and settings if editing
      if (current) {
        newStreet.name = current.name;
        newStreet.direction = current.direction;
        newStreet.functionalClass = current.functionalClass;
      }

      set({
        validationStatus: 'pending',
        currentStreet: newStreet,
        workId: get().workId ?? newStreet.id,
        selectedElementId: null,
        isTemplateGalleryOpen: false,
        validationResults: [],
      });
    },

    openTemplateGallery: () => set({ isTemplateGalleryOpen: true }),
    closeTemplateGallery: () => set({ isTemplateGalleryOpen: false }),

    setExporting: (exporting) => set({ isExporting: exporting }),
    toggleBeforeAfter: () => set((state) => ({ showBeforeAfter: !state.showBeforeAfter })),
  })),
);
