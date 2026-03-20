
import React, { useState } from 'react';
import type { ElementType, ElementSide } from '@/lib/types';
import { ELEMENT_COLORS, DEFAULT_CONSTRAINTS, DEFAULT_WIDTHS } from '@/lib/constants';
import { useStreetStore } from '@/stores/street-store';
import { Button } from '@/components/ui';
import { ElementRow } from './ElementRow';

const ELEMENT_TYPE_OPTIONS: { value: ElementType; label: string }[] = [
  { value: 'sidewalk', label: 'Sidewalk' },
  { value: 'planting-strip', label: 'Planting Strip' },
  { value: 'furniture-zone', label: 'Furniture Zone' },
  { value: 'bike-lane', label: 'Bike Lane' },
  { value: 'bike-lane-protected', label: 'Protected Bike Lane' },
  { value: 'buffer', label: 'Buffer' },
  { value: 'parking-lane', label: 'Parking Lane' },
  { value: 'travel-lane', label: 'Travel Lane' },
  { value: 'turn-lane', label: 'Turn Lane' },
  { value: 'transit-lane', label: 'Transit Lane' },
  { value: 'median', label: 'Median' },
  { value: 'curb', label: 'Curb' },
];

const SIDE_OPTIONS: { value: ElementSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

export function ElementList() {
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const selectedElementId = useStreetStore((s) => s.selectedElementId);
  const validationResults = useStreetStore((s) => s.validationResults);
  const addElement = useStreetStore((s) => s.addElement);
  const removeElement = useStreetStore((s) => s.removeElement);
  const updateElement = useStreetStore((s) => s.updateElement);
  const reorderElements = useStreetStore((s) => s.reorderElements);
  const selectElement = useStreetStore((s) => s.selectElement);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<ElementType>('travel-lane');
  const [newSide, setNewSide] = useState<ElementSide>('center');

  if (!currentStreet) return null;

  const elements = currentStreet.elements;

  // Build validation map: elementId -> results[]
  const validationMap = new Map<string, typeof validationResults>();
  for (const r of validationResults) {
    const list = validationMap.get(r.elementId);
    if (list) {
      list.push(r);
    } else {
      validationMap.set(r.elementId, [r]);
    }
  }

  const handleAdd = () => {
    addElement({
      type: newType,
      side: newSide,
      width: DEFAULT_WIDTHS[newType],
      constraints: DEFAULT_CONSTRAINTS[newType],
      locked: false,
      label: ELEMENT_COLORS[newType].label,
    });
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">
          Cross-Section Elements
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {elements.length} element{elements.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div
        role="listbox"
        aria-label="Cross-section elements"
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
      >
        {elements.map((element, index) => (
          <ElementRow
            key={element.id}
            element={element}
            index={index}
            totalCount={elements.length}
            isSelected={selectedElementId === element.id}
            validations={validationMap.get(element.id) ?? []}
            onSelect={() => selectElement(element.id)}
            onUpdateWidth={(w) => updateElement(element.id, { width: w })}
            onToggleLock={() =>
              updateElement(element.id, { locked: !element.locked })
            }
            onRemove={() => removeElement(element.id)}
            onMoveUp={() => reorderElements(index, index - 1)}
            onMoveDown={() => reorderElements(index, index + 1)}
          />
        ))}
      </div>

      <div className="px-3 py-3 border-t border-gray-200" role="group" aria-label="Add element">
        {showAddForm ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label
                  htmlFor="add-element-type"
                  className="text-xs font-medium text-gray-600 block mb-1"
                >
                  Type
                </label>
                <select
                  id="add-element-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ElementType)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {ELEMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="add-element-side"
                  className="text-xs font-medium text-gray-600 block mb-1"
                >
                  Side
                </label>
                <select
                  id="add-element-side"
                  value={newSide}
                  onChange={(e) => setNewSide(e.target.value as ElementSide)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {SIDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAdd} className="flex-1">
                Add
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowAddForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setShowAddForm(true)}
            className="w-full"
          >
            + Add Element
          </Button>
        )}
      </div>
    </div>
  );
}
