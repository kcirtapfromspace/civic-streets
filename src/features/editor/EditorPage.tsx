'use client';

import React, { useEffect } from 'react';
import { useStreetStore } from '@/stores/street-store';
import { CrossSectionSVG } from '@/features/renderer';
import { Toolbar } from './Toolbar';
import { ElementList } from './ElementList';
import { ElementProperties } from './ElementProperties';
import { ValidationPanel } from './ValidationPanel';

export function EditorPage() {
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const beforeStreet = useStreetStore((s) => s.beforeStreet);
  const showBeforeAfter = useStreetStore((s) => s.showBeforeAfter);
  const validationResults = useStreetStore((s) => s.validationResults);
  const selectedElementId = useStreetStore((s) => s.selectedElementId);
  const selectElement = useStreetStore((s) => s.selectElement);
  const setValidationResults = useStreetStore((s) => s.setValidationResults);

  // Re-validate whenever the street changes
  useEffect(() => {
    if (!currentStreet) {
      setValidationResults([]);
      return;
    }
    import('@/lib/standards')
      .then(({ validateStreet, loadStandards }) => {
        const standards = loadStandards();
        const results = validateStreet(currentStreet, standards);
        setValidationResults(results);
      })
      .catch(() => {
        // Standards engine not ready — skip validation
      });
  }, [currentStreet, setValidationResults]);

  if (!currentStreet) return null;

  const displayStreet =
    showBeforeAfter && beforeStreet ? beforeStreet : currentStreet;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Left panel: Element list + Properties */}
        <aside className="w-full lg:w-[300px] border-r border-gray-200 bg-white flex flex-col shrink-0 max-h-[40vh] lg:max-h-none overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <ElementList />
          </div>
          <div className="border-t border-gray-200 max-h-[50%] overflow-y-auto">
            <ElementProperties />
          </div>
        </aside>

        {/* Center: SVG cross-section */}
        <main className="flex-1 min-w-0 p-4 overflow-auto flex items-start justify-center">
          <div className="w-full max-w-full overflow-x-auto">
            {showBeforeAfter && beforeStreet && (
              <div className="mb-2 text-sm font-medium text-gray-500 text-center">
                Before (from template application)
              </div>
            )}
            <CrossSectionSVG
              street={displayStreet}
              validationResults={
                showBeforeAfter ? [] : validationResults
              }
              mode="display"
              onElementClick={(id) => selectElement(id)}
              selectedElementId={
                showBeforeAfter ? null : selectedElementId
              }
              showDimensions={true}
              showValidation={!showBeforeAfter}
            />
          </div>
        </main>

        {/* Right panel: Validation */}
        <aside className="w-full lg:w-[280px] border-l border-gray-200 bg-white shrink-0 max-h-[30vh] lg:max-h-none overflow-hidden">
          <ValidationPanel />
        </aside>
      </div>
    </div>
  );
}
