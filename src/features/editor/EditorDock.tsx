import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { CrossSectionSVG } from '@/features/renderer';
import { COMMON_ROW_WIDTHS, UNITS } from '@/lib/constants';
import { Button, Select, Tooltip } from '@/components/ui';
import type { FunctionalClass, StreetDirection } from '@/lib/types';

const FUNCTIONAL_CLASS_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'collector', label: 'Collector' },
  { value: 'minor-arterial', label: 'Minor Arterial' },
  { value: 'major-arterial', label: 'Major Arterial' },
];

const DIRECTION_OPTIONS = [
  { value: 'one-way', label: 'One-Way' },
  { value: 'two-way', label: 'Two-Way' },
];

const ROW_WIDTH_OPTIONS = COMMON_ROW_WIDTHS.map((w) => ({
  value: String(w),
  label: `${w} ${UNITS.primary}`,
}));

/**
 * Bottom-floating dock with inline toolbar + cross-section SVG.
 * Rendered inside EditorHUD when workspace mode is 'design'.
 */
export function EditorDock() {
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const beforeStreet = useStreetStore((s) => s.beforeStreet);
  const showBeforeAfter = useStreetStore((s) => s.showBeforeAfter);
  const isExporting = useStreetStore((s) => s.isExporting);
  const validationResults = useStreetStore((s) => s.validationResults);
  const selectedElementId = useStreetStore((s) => s.selectedElementId);
  const selectElement = useStreetStore((s) => s.selectElement);
  const updateStreetName = useStreetStore((s) => s.updateStreetName);
  const setROWWidth = useStreetStore((s) => s.setROWWidth);
  const setDirection = useStreetStore((s) => s.setDirection);
  const setFunctionalClass = useStreetStore((s) => s.setFunctionalClass);
  const openTemplateGallery = useStreetStore((s) => s.openTemplateGallery);
  const setExporting = useStreetStore((s) => s.setExporting);
  const toggleBeforeAfter = useStreetStore((s) => s.toggleBeforeAfter);

  const dockExpanded = useWorkspaceStore((s) => s.dockExpanded);
  const toggleDock = useWorkspaceStore((s) => s.toggleDock);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);

  const handleExport = useCallback(async () => {
    if (!currentStreet) return;
    setExporting(true);
    try {
      const { generatePDF } = await import('@/features/export');
      const blob = await generatePDF(
        currentStreet,
        beforeStreet,
        validationResults,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentStreet.name.replace(/\s+/g, '-').toLowerCase()}-cross-section.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'PDF export failed';
      alert(`Export not available yet: ${message}`);
    } finally {
      setExporting(false);
    }
  }, [currentStreet, beforeStreet, validationResults, setExporting]);

  const handleUndo = useCallback(() => {
    useStreetStore.temporal.getState().undo();
  }, []);

  const handleRedo = useCallback(() => {
    useStreetStore.temporal.getState().redo();
  }, []);

  if (!currentStreet) return null;

  const displayStreet =
    showBeforeAfter && beforeStreet ? beforeStreet : currentStreet;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-in-out ${
        dockExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-40px)]'
      }`}
    >
      {/* Collapse/Expand handle */}
      <div className="flex justify-center">
        <button
          onClick={toggleDock}
          className="relative -top-px bg-white/90 backdrop-blur-md border border-b-0 border-gray-200 rounded-t-lg px-4 py-1 text-gray-500 hover:text-gray-700 transition-colors text-xs font-medium flex items-center gap-1"
          aria-label={dockExpanded ? 'Collapse editor dock' : 'Expand editor dock'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${dockExpanded ? '' : 'rotate-180'}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M3.2 10.4a.6.6 0 010-.8L8 5l4.8 4.6a.6.6 0 01-.8.8L8 6.6 3.9 10.4a.6.6 0 01-.7 0z" />
          </svg>
          {dockExpanded ? 'Collapse' : currentStreet.name}
        </button>
      </div>

      {/* Dock body */}
      <div className="bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        {/* Inline toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 flex-wrap">
          {/* Street name */}
          <input
            type="text"
            value={currentStreet.name}
            onChange={(e) => updateStreetName(e.target.value)}
            className="px-2 py-0.5 text-sm font-semibold border border-transparent rounded hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-gray-300 bg-transparent max-w-[140px]"
            aria-label="Street name"
          />

          <div className="w-px h-5 bg-gray-200" aria-hidden="true" />

          <Select
            label="ROW"
            value={String(currentStreet.totalROWWidth)}
            onChange={(v) => setROWWidth(Number(v))}
            options={ROW_WIDTH_OPTIONS}
            className="flex-row items-center gap-1"
          />

          <Select
            label="Dir"
            value={currentStreet.direction}
            onChange={(v) => setDirection(v as StreetDirection)}
            options={DIRECTION_OPTIONS}
            className="flex-row items-center gap-1"
          />

          <Select
            label="Class"
            value={currentStreet.functionalClass}
            onChange={(v) => setFunctionalClass(v as FunctionalClass)}
            options={FUNCTIONAL_CLASS_OPTIONS}
            className="flex-row items-center gap-1"
          />

          <div className="flex-1" />

          {beforeStreet && (
            <Button
              variant={showBeforeAfter ? 'primary' : 'secondary'}
              onClick={toggleBeforeAfter}
              aria-pressed={showBeforeAfter}
              className="text-xs px-2 py-1"
            >
              {showBeforeAfter ? 'Before' : 'After'}
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={openTemplateGallery}
            className="text-xs px-2 py-1"
          >
            Templates
          </Button>

          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isExporting}
            className="text-xs px-2 py-1"
          >
            {isExporting ? 'Exporting...' : 'PDF'}
          </Button>

          <div className="w-px h-5 bg-gray-200" aria-hidden="true" />

          <Tooltip content="Undo">
            <Button variant="ghost" onClick={handleUndo} aria-label="Undo" className="px-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M4.854 3.146a.5.5 0 010 .708L2.707 6H9.5a4.5 4.5 0 010 9H7a.5.5 0 010-1h2.5a3.5 3.5 0 000-7H2.707l2.147 2.146a.5.5 0 01-.708.708l-3-3a.5.5 0 010-.708l3-3a.5.5 0 01.708 0z" />
              </svg>
            </Button>
          </Tooltip>
          <Tooltip content="Redo">
            <Button variant="ghost" onClick={handleRedo} aria-label="Redo" className="px-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M11.146 3.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L13.293 7H6.5a3.5 3.5 0 000 7H9a.5.5 0 010 1H6.5a4.5 4.5 0 010-9h6.793l-2.147-2.146a.5.5 0 010-.708z" />
              </svg>
            </Button>
          </Tooltip>

          <div className="w-px h-5 bg-gray-200" aria-hidden="true" />

          <Tooltip content="Exit to map (Esc)">
            <Button variant="ghost" onClick={exitToExplore} aria-label="Exit design mode" className="px-1.5 text-gray-400 hover:text-gray-600">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
              </svg>
            </Button>
          </Tooltip>
        </div>

        {/* Cross-section SVG */}
        <div className="overflow-x-auto px-2 py-1" style={{ maxHeight: 220 }}>
          <CrossSectionSVG
            street={displayStreet}
            validationResults={showBeforeAfter ? [] : validationResults}
            mode="display"
            onElementClick={(id) => selectElement(id)}
            selectedElementId={showBeforeAfter ? null : selectedElementId}
            showDimensions={true}
            showValidation={!showBeforeAfter}
          />
        </div>
      </div>
    </div>
  );
}
