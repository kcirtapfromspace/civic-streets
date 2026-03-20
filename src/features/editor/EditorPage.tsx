
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStreetStore } from '@/stores/street-store';
import { CrossSectionSVG } from '@/features/renderer';
import { Toolbar } from './Toolbar';
import { ElementList } from './ElementList';
import { ElementProperties } from './ElementProperties';
import { ValidationPanel } from './ValidationPanel';
import { ErrorBoundary } from '@/components/ui';

function EditorPageInner() {
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const beforeStreet = useStreetStore((s) => s.beforeStreet);
  const showBeforeAfter = useStreetStore((s) => s.showBeforeAfter);
  const isExporting = useStreetStore((s) => s.isExporting);
  const validationResults = useStreetStore((s) => s.validationResults);
  const selectedElementId = useStreetStore((s) => s.selectedElementId);
  const selectElement = useStreetStore((s) => s.selectElement);
  const setValidationResults = useStreetStore((s) => s.setValidationResults);

  // Track export completion for screen reader announcement
  const prevExportingRef = useRef(isExporting);
  const [exportDoneMessage, setExportDoneMessage] = useState('');
  useEffect(() => {
    if (!isExporting && prevExportingRef.current) {
      setExportDoneMessage('PDF export complete.');
      const timer = setTimeout(() => setExportDoneMessage(''), 3000);
      return () => clearTimeout(timer);
    }
    prevExportingRef.current = isExporting;
  }, [isExporting]);

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

  // Check for dimensional / total-width errors to show the infeasible warning
  const hasDimensionalError = useMemo(() => {
    return validationResults.some(
      (r) =>
        r.severity === 'error' &&
        (r.constraint === 'dimensional' || r.elementId === '__street__'),
    );
  }, [validationResults]);

  if (!currentStreet) return null;

  const hasNoElements = currentStreet.elements.length === 0;

  const displayStreet =
    showBeforeAfter && beforeStreet ? beforeStreet : currentStreet;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Skip navigation link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Screen reader announcement for export completion */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {exportDoneMessage}
      </div>

      {/* Screen reader announcement for before/after toggle */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {showBeforeAfter && beforeStreet
          ? 'Showing before view from template application'
          : ''}
      </div>

      {/* Visually hidden h1 for heading hierarchy */}
      <h1 className="sr-only">
        Street Copilot — Editing {currentStreet.name}
      </h1>

      {/* Toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Left panel: Element list + Properties */}
        <aside
          aria-label="Element list and properties"
          className="w-full lg:w-[300px] border-r border-gray-200 bg-white flex flex-col shrink-0 max-h-[40vh] lg:max-h-none overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto">
            <ElementList />
          </div>
          <div className="border-t border-gray-200 max-h-[50%] overflow-y-auto">
            <ElementProperties />
          </div>
        </aside>

        {/* Center: SVG cross-section */}
        <main
          id="main-content"
          aria-label="Street cross-section editor"
          className="flex-1 min-w-0 p-4 overflow-auto flex flex-col items-start justify-start"
        >
          {/* Infeasible ROW warning banner */}
          {hasDimensionalError && !showBeforeAfter && (
            <div
              className="w-full mb-3 flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
              role="alert"
            >
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86l-8.4 14.31A1 1 0 002.73 20h18.53a1 1 0 00.85-1.83l-8.4-14.31a1 1 0 00-1.7 0z"
                />
              </svg>
              <span>
                This design exceeds the available right-of-way width. Consider
                widening the ROW or removing elements.
              </span>
            </div>
          )}

          <div className="w-full max-w-full overflow-x-auto">
            {showBeforeAfter && beforeStreet && (
              <div className="mb-2 text-sm font-medium text-gray-500 text-center">
                Before (from template application)
              </div>
            )}

            {/* Zero-elements empty state */}
            {hasNoElements && !showBeforeAfter ? (
              <div className="flex items-center justify-center w-full min-h-[300px] rounded-lg border border-dashed border-gray-300 bg-white">
                <p className="text-sm text-gray-500 text-center px-6">
                  No elements in this cross-section. Add elements from the panel
                  on the left.
                </p>
              </div>
            ) : (
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
            )}
          </div>
        </main>

        {/* Right panel: Validation */}
        <aside
          aria-label="Validation results"
          className="w-full lg:w-[280px] border-l border-gray-200 bg-white shrink-0 max-h-[30vh] lg:max-h-none overflow-hidden"
        >
          <ValidationPanel />
        </aside>
      </div>
    </div>
  );
}

export function EditorPage() {
  return (
    <ErrorBoundary>
      <EditorPageInner />
    </ErrorBoundary>
  );
}
