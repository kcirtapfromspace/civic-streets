'use client';

import React, { useCallback } from 'react';
import { useStreetStore } from '@/stores/street-store';
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

export function Toolbar() {
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const beforeStreet = useStreetStore((s) => s.beforeStreet);
  const showBeforeAfter = useStreetStore((s) => s.showBeforeAfter);
  const isExporting = useStreetStore((s) => s.isExporting);
  const validationResults = useStreetStore((s) => s.validationResults);
  const updateStreetName = useStreetStore((s) => s.updateStreetName);
  const setROWWidth = useStreetStore((s) => s.setROWWidth);
  const setDirection = useStreetStore((s) => s.setDirection);
  const setFunctionalClass = useStreetStore((s) => s.setFunctionalClass);
  const openTemplateGallery = useStreetStore((s) => s.openTemplateGallery);
  const setExporting = useStreetStore((s) => s.setExporting);
  const toggleBeforeAfter = useStreetStore((s) => s.toggleBeforeAfter);

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

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
      {/* Street name */}
      <div>
        <label htmlFor="street-name" className="sr-only">
          Street name
        </label>
        <input
          id="street-name"
          type="text"
          value={currentStreet.name}
          onChange={(e) => updateStreetName(e.target.value)}
          className="px-2 py-1 text-sm font-semibold border border-transparent rounded hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-gray-300 bg-transparent"
          aria-label="Street name"
        />
      </div>

      <div className="w-px h-6 bg-gray-200" aria-hidden="true" />

      {/* ROW Width */}
      <Select
        label="ROW Width"
        value={String(currentStreet.totalROWWidth)}
        onChange={(v) => setROWWidth(Number(v))}
        options={ROW_WIDTH_OPTIONS}
      />

      {/* Direction */}
      <Select
        label="Direction"
        value={currentStreet.direction}
        onChange={(v) => setDirection(v as StreetDirection)}
        options={DIRECTION_OPTIONS}
      />

      {/* Functional class */}
      <Select
        label="Functional Class"
        value={currentStreet.functionalClass}
        onChange={(v) => setFunctionalClass(v as FunctionalClass)}
        options={FUNCTIONAL_CLASS_OPTIONS}
      />

      <div className="flex-1" />

      {/* Before/After toggle */}
      {beforeStreet && (
        <Tooltip content="Toggle before/after comparison">
          <Button
            variant={showBeforeAfter ? 'primary' : 'secondary'}
            onClick={toggleBeforeAfter}
          >
            {showBeforeAfter ? 'Before' : 'After'}
          </Button>
        </Tooltip>
      )}

      {/* Templates */}
      <Button variant="secondary" onClick={openTemplateGallery}>
        Templates
      </Button>

      {/* Export PDF */}
      <Button
        variant="primary"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export PDF'}
      </Button>

      <div className="w-px h-6 bg-gray-200" aria-hidden="true" />

      {/* Undo/Redo */}
      <Tooltip content="Undo (Ctrl+Z)">
        <Button variant="ghost" onClick={handleUndo} aria-label="Undo">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M4.854 3.146a.5.5 0 010 .708L2.707 6H9.5a4.5 4.5 0 010 9H7a.5.5 0 010-1h2.5a3.5 3.5 0 000-7H2.707l2.147 2.146a.5.5 0 01-.708.708l-3-3a.5.5 0 010-.708l3-3a.5.5 0 01.708 0z" />
          </svg>
        </Button>
      </Tooltip>
      <Tooltip content="Redo (Ctrl+Shift+Z)">
        <Button variant="ghost" onClick={handleRedo} aria-label="Redo">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M11.146 3.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L13.293 7H6.5a3.5 3.5 0 000 7H9a.5.5 0 010 1H6.5a4.5 4.5 0 010-9h6.793l-2.147-2.146a.5.5 0 010-.708z" />
          </svg>
        </Button>
      </Tooltip>
    </div>
  );
}
