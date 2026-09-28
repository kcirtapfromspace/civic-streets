import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveEditorWork } from './use-editor-draft';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useStreetStore } from '@/stores/street-store';
import { COMMON_ROW_WIDTHS, UNITS } from '@/lib/constants';
import { Button, Select, Tooltip } from '@/components/ui';
import type { FunctionalClass, StreetDirection } from '@/lib/types';
import { captureAnalytics } from '@/lib/analytics';

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
  const navigate = useNavigate();
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const beforeStreet = useStreetStore((s) => s.beforeStreet);
  const showBeforeAfter = useStreetStore((s) => s.showBeforeAfter);
  const isExporting = useStreetStore((s) => s.isExporting);
  const validationResults = useStreetStore((s) => s.validationResults);
  const validationStatus = useStreetStore((s) => s.validationStatus);
  const updateStreetName = useStreetStore((s) => s.updateStreetName);
  const setROWWidth = useStreetStore((s) => s.setROWWidth);
  const setDirection = useStreetStore((s) => s.setDirection);
  const setFunctionalClass = useStreetStore((s) => s.setFunctionalClass);
  const openTemplateGallery = useStreetStore((s) => s.openTemplateGallery);
  const setExporting = useStreetStore((s) => s.setExporting);
  const toggleBeforeAfter = useStreetStore((s) => s.toggleBeforeAfter);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleExport = useCallback(async () => {
    if (!currentStreet) return;
    const proposal = useProposalStore.getState();
    const linkedProposalId = useWorkspaceStore.getState().designProposalId;
    const briefContext =
      proposal.afterStreet?.id === currentStreet.id ||
      (linkedProposalId && linkedProposalId === proposal.proposalId)
        ? proposal.briefContext
        : undefined;
    setExportMessage('');
    setExportError('');
    setExporting(true);
    try {
      const { generatePDF } = await import('@/features/export');
      const blob = await generatePDF(
        currentStreet,
        beforeStreet,
        validationResults,
        briefContext,
        validationStatus,
      );
      if (!mountedRef.current) return;
      const latest = useStreetStore.getState();
      if (
        latest.currentStreet !== currentStreet ||
        latest.beforeStreet !== beforeStreet ||
        latest.validationResults !== validationResults ||
        latest.validationStatus !== validationStatus ||
        (briefContext && useProposalStore.getState().briefContext !== briefContext)
      ) {
        setExportError(
          'Your work changed while the PDF was being prepared. Export again to include the latest version.',
        );
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentStreet.name.replace(/\s+/g, '-').toLowerCase()}-cross-section.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMessage('PDF downloaded. Review it before sharing.');
      captureAnalytics('street_design_pdf_exported');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF export failed';
      if (mountedRef.current)
        setExportError(
          `PDF could not be downloaded: ${message}. Your design is still here. Try again.`,
        );
    } finally {
      setExporting(false);
    }
  }, [currentStreet, beforeStreet, validationResults, validationStatus, setExporting]);

  const handleUndo = useCallback(() => {
    useStreetStore.temporal.getState().undo();
  }, []);

  const handleRedo = useCallback(() => {
    useStreetStore.temporal.getState().redo();
  }, []);

  if (!currentStreet) return null;

  return (
    <div
      role="toolbar"
      aria-label="Street editor toolbar"
      className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-wrap"
    >
      {exportMessage && (
        <p role="status" className="w-full text-sm text-gray-700">
          {exportMessage}
        </p>
      )}
      {exportError && (
        <p role="alert" className="w-full text-sm text-red-700">
          {exportError}
        </p>
      )}
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
          className="min-h-11 w-40 sm:w-auto px-2 py-1 text-sm font-semibold border border-transparent rounded hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-gray-300 bg-transparent"
          aria-label="Street name"
        />
      </div>

      <div className="w-px h-6 bg-gray-200" aria-hidden="true" />

      <button
        type="button"
        onClick={() => setSettingsOpen((open) => !open)}
        aria-expanded={settingsOpen}
        aria-controls="street-settings"
        className="min-h-11 rounded border border-gray-300 px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
      >
        Street settings
      </button>
      <div
        id="street-settings"
        className={`${settingsOpen ? 'flex' : 'hidden'} order-last w-full flex-wrap items-center gap-3 lg:order-none lg:flex lg:w-auto`}
      >
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
      </div>
      <div className="flex-1" />

      {/* Before/After toggle */}
      {beforeStreet && (
        <Tooltip content="Toggle before/after comparison">
          <Button
            variant={showBeforeAfter ? 'primary' : 'secondary'}
            onClick={toggleBeforeAfter}
            aria-pressed={showBeforeAfter}
            aria-label={
              showBeforeAfter
                ? 'Showing before view — click to show after'
                : 'Showing after view — click to show before'
            }
          >
            {showBeforeAfter ? 'Before' : 'After'}
          </Button>
        </Tooltip>
      )}

      {/* Templates */}
      <Button variant="secondary" onClick={openTemplateGallery}>
        Templates
      </Button>

      <Button variant="secondary" onClick={() => {
        const work = saveEditorWork();
        if (!work) {
          setExportError('Your latest work could not be saved. Keep this page open and retry.');
          return;
        }
        useProposalStore.getState().loadWork(work);
        if (work.location && work.roadPath.length >= 2) {
          useWorkspaceStore.getState().enterDesignMode(work.location, work.id);
        } else {
          useWorkspaceStore.setState({ mode: 'place-street', designLocation: work.location, designProposalId: work.id });
        }
        navigate('/map');
      }}>View on map</Button>

      <Button
        onClick={() => {
          const work = saveEditorWork();
          if (!work) {
            setExportError('Your latest work could not be saved. Keep this page open and retry.');
            return;
          }
          useProposalStore.getState().loadWork(work);
          useWorkspaceStore.setState({
            mode: 'propose',
            designLocation: work.location,
            designProposalId: null,
          });
          navigate('/map');
        }}
      >
        Review brief
      </Button>
      {/* Export PDF */}
      <Button
        variant="primary"
        onClick={handleExport}
        disabled={isExporting}
        aria-busy={isExporting}
      >
        {isExporting && (
          <svg
            className="animate-spin -ml-0.5 mr-1.5 h-4 w-4 inline-block"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {isExporting ? 'Exporting...' : 'Export PDF'}
      </Button>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {isExporting ? 'PDF export in progress' : ''}
      </div>

      <div className="w-px h-6 bg-gray-200" aria-hidden="true" />

      {/* Undo/Redo */}
      <Tooltip content="Undo (Ctrl+Z)">
        <Button variant="ghost" onClick={handleUndo} aria-label="Undo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M4.854 3.146a.5.5 0 010 .708L2.707 6H9.5a4.5 4.5 0 010 9H7a.5.5 0 010-1h2.5a3.5 3.5 0 000-7H2.707l2.147 2.146a.5.5 0 01-.708.708l-3-3a.5.5 0 010-.708l3-3a.5.5 0 01.708 0z" />
          </svg>
        </Button>
      </Tooltip>
      <Tooltip content="Redo (Ctrl+Shift+Z)">
        <Button variant="ghost" onClick={handleRedo} aria-label="Redo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M11.146 3.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L13.293 7H6.5a3.5 3.5 0 000 7H9a.5.5 0 010 1H6.5a4.5 4.5 0 010-9h6.793l-2.147-2.146a.5.5 0 010-.708z" />
          </svg>
        </Button>
      </Tooltip>
    </div>
  );
}
