import { useState } from 'react';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { COMMON_ROW_WIDTHS, UNITS } from '@/lib/constants';
import { Button, Select } from '@/components/ui';
import type { FunctionalClass, StreetDirection } from '@/lib/types';

const FUNCTIONAL_CLASS_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'collector', label: 'Collector' },
  { value: 'minor-arterial', label: 'Minor Arterial' },
  { value: 'major-arterial', label: 'Major Arterial' },
];

const DIRECTION_OPTIONS = [
  { value: 'two-way', label: 'Two-Way' },
  { value: 'one-way', label: 'One-Way' },
];

const ROW_WIDTH_OPTIONS = COMMON_ROW_WIDTHS.map((w) => ({
  value: String(w),
  label: `${w} ${UNITS.label}`,
}));

/**
 * Compact form for configuring a new street from the map.
 * Renders as a bottom sheet when workspace mode is 'configure'.
 * Location (address) is pre-filled from the map click.
 */
export function CompactNewStreetForm() {
  const createNewStreet = useStreetStore((s) => s.createNewStreet);
  const designLocation = useWorkspaceStore((s) => s.designLocation);
  const enterDesignMode = useWorkspaceStore((s) => s.enterDesignMode);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);

  const [name, setName] = useState(designLocation?.address ?? 'Main Street');
  const [rowWidth, setRowWidth] = useState('66');
  const [functionalClass, setFunctionalClass] =
    useState<FunctionalClass>('collector');
  const [direction, setDirection] = useState<StreetDirection>('two-way');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const location = designLocation ?? undefined;
    createNewStreet(
      name.trim(),
      Number(rowWidth),
      functionalClass,
      direction,
      location,
    );
    enterDesignMode();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto">
      <div className="mx-auto max-w-lg">
        {/* Handle bar for visual cue */}
        <div className="flex justify-center pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/95 backdrop-blur-md rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.12)] border border-b-0 border-gray-200 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              New Street Design
            </h2>
            <button
              type="button"
              onClick={exitToExplore}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Cancel"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
              </svg>
            </button>
          </div>

          {/* Location badge */}
          {designLocation && (
            <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-blue-50 rounded-md text-xs text-blue-700">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{designLocation.address}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="compact-street-name" className="text-xs font-medium text-gray-700 block mb-1">
                Street Name
              </label>
              <input
                id="compact-street-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Main Street"
                required
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Select
                label="ROW Width"
                value={rowWidth}
                onChange={setRowWidth}
                options={ROW_WIDTH_OPTIONS}
              />
              <Select
                label="Classification"
                value={functionalClass}
                onChange={(v) => setFunctionalClass(v as FunctionalClass)}
                options={FUNCTIONAL_CLASS_OPTIONS}
              />
              <Select
                label="Direction"
                value={direction}
                onChange={(v) => setDirection(v as StreetDirection)}
                options={DIRECTION_OPTIONS}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2"
            >
              Create Street
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
