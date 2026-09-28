import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStreetStore } from '@/stores/street-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { generatePDF } from '@/features/export';
import { loadStandards, validateStreet } from '@/lib/standards/validator';
import { captureAnalytics } from '@/lib/analytics';
import type { DiscussionBriefContext, ElementType } from '@/lib/types';

const ELEMENT_NAMES: Record<ElementType, string> = {
  sidewalk: 'Sidewalks', 'planting-strip': 'Planting strips', 'furniture-zone': 'Furniture zones',
  'bike-lane': 'Bike lanes', 'bike-lane-protected': 'Protected bike lanes', buffer: 'Buffers',
  'parking-lane': 'Parking lanes', 'travel-lane': 'Travel lanes', 'turn-lane': 'Turn lanes',
  'transit-lane': 'Transit lanes', median: 'Medians', curb: 'Curbs',
};

const CrossSectionSVG = lazy(() =>
  import('@/features/renderer/CrossSectionSVG').then((m) => ({
    default: m.CrossSectionSVG,
  })),
);

export function ProposalReview() {
  const beforeStreet = useProposalStore((s) => s.beforeStreet);
  const afterStreet = useProposalStore((s) => s.afterStreet);
  const showBeforeOnMap = useProposalStore((s) => s.showBeforeOnMap);
  const toggleMapView = useProposalStore((s) => s.toggleMapView);
  const goBack = useProposalStore((s) => s.goBack);
  const selectedPreset = useProposalStore((s) => s.selectedPreset);
  const streetName = useProposalStore((s) => s.streetName);
  const roadPath = useProposalStore((s) => s.roadPath);
  const briefContext = useProposalStore((s) => s.briefContext);
  const setBriefContext = useProposalStore((s) => s.setBriefContext);
  const validationResults = useMemo(() => afterStreet ? validateStreet(afterStreet, loadStandards()) : [], [afterStreet]);

  const enterDesignMode = useWorkspaceStore((s) => s.enterDesignMode);
  const designLocation = useWorkspaceStore((s) => s.designLocation);
  const setStreet = useStreetStore((s) => s.setStreet);
  const setBeforeStreet = useStreetStore((s) => s.setBeforeStreet);

  const [isSavingPDF, setIsSavingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const exportingRef = useRef(false);
  const mountedRef = useRef(false);
  const pdfUrlRef = useRef<string | null>(null);
  const [preparedPDF, setPreparedPDF] = useState<{ url: string; filename: string; version: string } | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    };
  }, []);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);
  const draftVersion = JSON.stringify([beforeStreet, afterStreet, briefContext]);
  const latestVersionRef = useRef(draftVersion);
  useEffect(() => { latestVersionRef.current = draftVersion; }, [draftVersion]);
  const measurementSourceMissing = briefContext.dimensionBasis === 'measured' && !briefContext.dimensionSource.trim();

  if (!beforeStreet || !afterStreet) return null;

  const allocationChanges = (Object.keys(ELEMENT_NAMES) as ElementType[]).map((type) => {
    const before = beforeStreet.elements.filter((element) => element.type === type);
    const after = afterStreet.elements.filter((element) => element.type === type);
    const beforeWidth = Number(before.reduce((total, element) => total + element.width, 0).toFixed(1));
    const afterWidth = Number(after.reduce((total, element) => total + element.width, 0).toFixed(1));
    return { type, beforeCount: before.length, afterCount: after.length, beforeWidth, afterWidth };
  }).filter((change) => change.beforeCount !== change.afterCount || change.beforeWidth !== change.afterWidth);

  const handleEditDetails = () => {
    setStreet(afterStreet);
    setBeforeStreet(beforeStreet);
    useStreetStore.temporal.getState().clear();
    enterDesignMode(designLocation ?? undefined, useProposalStore.getState().proposalId ?? undefined);
  };

  const handleSavePDF = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setIsSavingPDF(true);
    setPdfError(null);
    const exportVersion = draftVersion;
    try {
      const blob = await generatePDF(afterStreet, beforeStreet, validationResults, briefContext);
      if (!mountedRef.current || latestVersionRef.current !== exportVersion) return;
      const url = URL.createObjectURL(blob);
      const filename = `${streetName || 'proposal'}-discussion-brief.pdf`;
      const previousUrl = pdfUrlRef.current;
      pdfUrlRef.current = url;
      setPreparedPDF({ url, filename, version: exportVersion });
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      try {
        document.body.appendChild(a);
        a.click();
      } catch {
        // The visible download link remains available if an automatic download is blocked.
      } finally {
        a.remove();
      }
      captureAnalytics('proposal_pdf_exported');
    } catch {
      if (mountedRef.current && latestVersionRef.current === exportVersion) setPdfError('The PDF could not be generated. Please try again.');
    } finally {
      exportingRef.current = false;
      if (mountedRef.current) setIsSavingPDF(false);
    }
  };

  const handleSaveDraft = () => {
    setSaveError(null);
    const proposal = useProposalStore.getState().getProposal();
    try {
      if (!useProposalStore.getState().saveWork()) throw new Error(useWorkDraftsStore.getState().storageError ?? 'The draft could not be saved. Your work is still here.');
      if (proposal) useSavedProposalsStore.getState().saveProposal(proposal);
      setSavedVersion(draftVersion);
      captureAnalytics('proposal_draft_saved', { element_count: afterStreet.elements.length });
    } catch (error) {
      setSavedVersion(null);
      setSaveError((error as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => selectedPreset ? goBack() : useProposalStore.setState({ step: 'concern' })}
          aria-label={selectedPreset ? 'Choose another improvement' : 'Back to concern'}
          className="min-h-11 min-w-11 flex items-center justify-center text-[#59646a] hover:text-[#172126] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-[#172126]">
          Discussion brief for {streetName || 'this street'}
        </h3>
      </div>

      <button type="button" onClick={() => useWorkspaceStore.setState({ mode: 'place-street', designProposalId: useProposalStore.getState().proposalId })} className="min-h-11 border border-[#d8dddf] px-3 text-sm font-medium">
        {roadPath.length >= 2 ? 'Adjust map placement' : 'Place this layout on the map'}
      </button>
      <p className="text-xs text-[#59646a]">{roadPath.length >= 2 ? 'The map shows your layout along the selected path. Placement is approximate; widths come from this concept.' : 'Mark the street centerline to see this layout in its surroundings.'}</p>

      {/* Before / After toggle for map */}
      <div className="flex items-center gap-1 bg-[#f3f5f5] rounded-sm p-0.5">
        <button
          onClick={() => { if (!showBeforeOnMap) toggleMapView(); }}
          aria-pressed={showBeforeOnMap}
          className={`flex-1 min-h-11 text-xs font-medium py-1.5 rounded-md transition-colors ${
            showBeforeOnMap
              ? 'bg-white text-[#172126] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Before
        </button>
        <button
          onClick={() => { if (showBeforeOnMap) toggleMapView(); }}
          aria-pressed={!showBeforeOnMap}
          className={`flex-1 min-h-11 text-xs font-medium py-1.5 rounded-md transition-colors ${
            !showBeforeOnMap
              ? 'bg-white text-[#172126] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          After
        </button>
      </div>

      {/* Cross-section comparison */}
      <div className="flex flex-col gap-2">
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Before
          </div>
          <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
            <div className="overflow-x-auto" style={{ maxHeight: 140 }}>
              <Suspense fallback={null}>
                <CrossSectionSVG
                  street={beforeStreet}
                  mode="display"
                  showDimensions={false}
                  showValidation={false}
                />
              </Suspense>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold text-[#59646a] uppercase tracking-wider mb-1">
            After
          </div>
          <div className="border border-[#d8dddf] rounded-sm overflow-hidden bg-[#f3f5f5]">
            <div className="overflow-x-auto" style={{ maxHeight: 140 }}>
              <Suspense fallback={null}>
                <CrossSectionSVG
                  street={afterStreet}
                  mode="display"
                  showDimensions={false}
                  showValidation={false}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs leading-relaxed">
        <h4 className="font-medium">What changes in this layout</h4>
        {allocationChanges.length === 0 ? <p className="mt-1 text-[#59646a]">The allocated widths and element counts are unchanged.</p> : <ul className="mt-1 space-y-1 text-[#59646a]">{allocationChanges.map((change) => <li key={change.type}>{ELEMENT_NAMES[change.type]}: {change.beforeCount} → {change.afterCount}; {change.beforeWidth} → {change.afterWidth} ft total.</li>)}</ul>}
        <p className="mt-2 text-[#59646a]">Widths are summed across the street. These changes do not predict safety or traffic outcomes.</p>
      </div>

      <label className="text-xs font-medium text-[#172126]">
        What are you asking for?
        <textarea value={briefContext.requestedNextStep} onChange={(event) => setBriefContext({ requestedNextStep: event.target.value })} rows={2} maxLength={2000} placeholder="For example, a site visit or feedback on this option." className="mt-1 w-full rounded-sm border border-[#d8dddf] px-3 py-2 text-sm font-normal leading-relaxed focus:border-[#172126] focus:outline-none" />
      </label>

      <details className="border-y border-[#d8dddf] py-1">
        <summary className="min-h-11 cursor-pointer content-center text-xs font-medium">Dimensions &amp; selected checks</summary>
        <div className="flex flex-col gap-3 pb-3">
          <label className="text-xs font-medium">
            Existing layout dimensions are
            <select value={briefContext.dimensionBasis} onChange={(event) => setBriefContext({ dimensionBasis: event.target.value as DiscussionBriefContext['dimensionBasis'] })} className="mt-1 min-h-11 w-full rounded-sm border border-[#d8dddf] bg-white px-3 text-sm">
              <option value="assumed">Assumed from a template</option>
              <option value="estimated">Estimated</option>
              <option value="measured">Measured by the contributor</option>
            </select>
          </label>
          <label className="text-xs font-medium">
            Dimension source or method{briefContext.dimensionBasis === 'measured' ? ' (required)' : ' (optional)'}
            <input value={briefContext.dimensionSource} onChange={(event) => setBriefContext({ dimensionSource: event.target.value })} maxLength={1000} placeholder="Where the widths came from, and when." aria-describedby="dimension-source-note" className="mt-1 min-h-11 w-full rounded-sm border border-[#d8dddf] px-3 text-sm" />
          </label>
          <p id="dimension-source-note" className="text-xs leading-relaxed text-[#59646a]">{measurementSourceMissing ? 'Add a source or method before downloading a brief labeled measured. You can save an unfinished draft.' : 'Dimensions are contributor-supplied and not independently verified. The proposed layout remains a concept.'}</p>
          <div className="text-xs leading-relaxed text-[#59646a]">
            <h4 className="font-medium text-[#172126]">Selected dimension checks</h4>
            <p className="mt-1">Only selected widths and total allocations are checked against the stored guidance. Site conditions, crossings, traffic operations, and overall accessibility are not assessed.</p>
            {validationResults.length === 0 ? <p className="mt-2">No flags from the selected checks. This is not a compliance determination.</p> : <ul className="mt-2 list-disc space-y-2 pl-4">{validationResults.map((result, index) => <li key={`${result.elementId}-${index}`}>{result.message} <span className="block">{result.citation}</span></li>)}</ul>}
          </div>
        </div>
      </details>
      <p className="text-xs text-[#59646a]">Existing dimensions: {briefContext.dimensionBasis}. Proposed widths are a concept for discussion.</p>
      {measurementSourceMissing && <p role="alert" className="text-xs text-red-700">Add the measurement source under Dimensions &amp; selected checks.</p>}

      {/* Actions */}
      <p className="text-xs leading-relaxed text-[#59646a]">
        Drafts stay in this browser. Download a brief to share for discussion; nothing is sent to the city. Clearing browser data removes drafts.
      </p>
      {savedVersion === draftVersion && <p role="status" className="text-xs font-medium text-[#172126]">Draft saved in this browser. Reopen it from Saved drafts on the map.</p>}
      {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
      {pdfError && <p role="alert" className="text-xs text-red-700">{pdfError}</p>}
      {preparedPDF && preparedPDF.version === draftVersion && (
        <div className="border border-[#d8dddf] bg-[#f3f5f5] px-3 py-2 text-xs text-[#172126]">
          <p role="status">Discussion brief ready. Download again after making changes.</p>
          <a href={preparedPDF.url} download={preparedPDF.filename} className="inline-flex min-h-11 items-center font-medium underline">
            Download prepared brief
          </a>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          onClick={handleEditDetails}
          className="bg-[#f3f5f5] hover:bg-gray-200 text-gray-700 min-h-11 text-xs font-medium py-2 px-3 rounded-sm transition-colors"
        >
          Edit street layout
        </button>
        <button
          onClick={handleSaveDraft}
          className="bg-[#f3f5f5] hover:bg-gray-200 text-gray-700 min-h-11 text-xs font-medium py-2 px-3 rounded-sm transition-colors disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          onClick={handleSavePDF}
          disabled={isSavingPDF || measurementSourceMissing}
          className="col-span-2 bg-[#172126] hover:bg-[#2d383e] text-white min-h-11 text-xs font-medium py-2 px-3 rounded-sm transition-colors disabled:opacity-50"
        >
          {isSavingPDF ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Preparing…
            </span>
          ) : 'Download discussion brief'}
        </button>
      </div>
    </div>
  );
}
