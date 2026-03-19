import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  StreetSegment,
  CrossSectionElement,
  ValidationResult,
  TemplateDefinition,
  ElementType,
  FunctionalClass,
  StreetDirection,
} from '@/lib/types';
import { DEFAULT_CONSTRAINTS, DEFAULT_WIDTHS } from '@/lib/constants';

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
  // Optional "before" street for comparison
  beforeStreet: StreetSegment | null;
  // Validation results from standards engine
  validationResults: ValidationResult[];
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
  ) => void;

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
  toggleBeforeAfter: () => void;
}

export const useStreetStore = create<StreetState>()(
  temporal(
    (set, get) => ({
      currentStreet: null,
      beforeStreet: null,
      validationResults: [],
      selectedElementId: null,
      isTemplateGalleryOpen: false,
      isExporting: false,
      showBeforeAfter: false,

      setStreet: (street) =>
        set({ currentStreet: street }),

      setBeforeStreet: (street) =>
        set({ beforeStreet: street }),

      updateStreetName: (name) => {
        const current = get().currentStreet;
        if (!current) return;
        set({
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
          currentStreet: {
            ...current,
            functionalClass: fc,
            metadata: { ...current.metadata, updatedAt: updatedAt() },
          },
        });
      },

      createNewStreet: (name, rowWidth, functionalClass, direction) => {
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
        };
        set({
          currentStreet: street,
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
          const firstNonLeft = elements.findIndex(
            (el) => el.side !== 'left',
          );
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
          const centerStart = elements.findIndex(
            (el) => el.side === 'center',
          );
          const centerEnd = elements.reduce(
            (last, el, i) => (el.side === 'center' ? i : last),
            -1,
          );
          if (centerStart === -1) {
            // No center elements — insert after left elements
            const firstRight = elements.findIndex(
              (el) => el.side === 'right',
            );
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
        const selectedId =
          get().selectedElementId === id ? null : get().selectedElementId;

        set({
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

        const elements = current.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el,
        );

        set({
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
          currentStreet: {
            ...current,
            elements,
            metadata: { ...current.metadata, updatedAt: updatedAt() },
          },
        });
      },

      selectElement: (id) => set({ selectedElementId: id }),

      setValidationResults: (results) =>
        set({ validationResults: results }),

      applyTemplate: (template, rowWidth) => {
        const current = get().currentStreet;

        // Save current street as the "before" for comparison
        if (current) {
          set({ beforeStreet: { ...current } });
        }

        // Build new street from template elements directly.
        // When WS3 adaptTemplate is ready, this can be replaced with
        // the adapter call for parametric width fitting.
        const now = new Date().toISOString();
        const elements: CrossSectionElement[] = template.elements.map(
          (el) => ({
            ...el,
            id: crypto.randomUUID(),
          }),
        );

        const newStreet: StreetSegment = {
          id: crypto.randomUUID(),
          name: current?.name ?? template.name,
          totalROWWidth: rowWidth,
          curbToCurbWidth: computeCurbToCurb(elements),
          direction: current?.direction ?? 'two-way',
          functionalClass:
            current?.functionalClass ??
            template.applicableFunctionalClasses[0] ??
            'local',
          elements,
          metadata: {
            createdAt: now,
            updatedAt: now,
            templateId: template.id,
          },
        };

        set({
          currentStreet: newStreet,
          selectedElementId: null,
          isTemplateGalleryOpen: false,
          validationResults: [],
        });
      },

      openTemplateGallery: () => set({ isTemplateGalleryOpen: true }),
      closeTemplateGallery: () => set({ isTemplateGalleryOpen: false }),

      setExporting: (exporting) => set({ isExporting: exporting }),
      toggleBeforeAfter: () =>
        set((state) => ({ showBeforeAfter: !state.showBeforeAfter })),
    }),
  ),
);
