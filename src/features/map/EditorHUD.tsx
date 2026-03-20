import { Suspense, lazy, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStreetStore } from '@/stores/street-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useMapStore } from './map-store';

// Lazy-load editor components to keep initial map bundle small
const EditorDock = lazy(() =>
  import('@/features/editor/EditorDock').then((m) => ({ default: m.EditorDock })),
);
const EditorSidePanel = lazy(() =>
  import('@/features/editor/EditorSidePanel').then((m) => ({ default: m.EditorSidePanel })),
);
const CompactNewStreetForm = lazy(() =>
  import('@/features/editor/CompactNewStreetForm').then((m) => ({ default: m.CompactNewStreetForm })),
);
const ElementList = lazy(() =>
  import('@/features/editor/ElementList').then((m) => ({ default: m.ElementList })),
);
const ElementProperties = lazy(() =>
  import('@/features/editor/ElementProperties').then((m) => ({ default: m.ElementProperties })),
);
const ValidationPanel = lazy(() =>
  import('@/features/editor/ValidationPanel').then((m) => ({ default: m.ValidationPanel })),
);
const TemplateGalleryModal = lazy(() =>
  import('@/features/gallery').then((m) => ({ default: m.TemplateGalleryModal })),
);
const ProposalFlow = lazy(() =>
  import('@/features/proposal/ProposalFlow').then((m) => ({ default: m.ProposalFlow })),
);
const IntersectionFlow = lazy(() =>
  import('@/features/intersection/IntersectionFlow').then((m) => ({ default: m.IntersectionFlow })),
);

/**
 * Orchestrator component: renders floating editor panels on top of the map.
 * Manages which panels are visible based on workspace mode.
 */
export function EditorHUD() {
  const mode = useWorkspaceStore((s) => s.mode);
  const showElementPanel = useWorkspaceStore((s) => s.showElementPanel);
  const showValidationPanel = useWorkspaceStore((s) => s.showValidationPanel);
  const toggleElementPanel = useWorkspaceStore((s) => s.toggleElementPanel);
  const toggleValidationPanel = useWorkspaceStore((s) => s.toggleValidationPanel);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);
  const designLocation = useWorkspaceStore((s) => s.designLocation);

  const currentStreet = useStreetStore((s) => s.currentStreet);
  const setValidationResults = useStreetStore((s) => s.setValidationResults);

  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const setLockedToLocation = useMapStore((s) => s.setLockedToLocation);

  // Zoom to design location when entering configure/design/propose mode
  useEffect(() => {
    if ((mode === 'configure' || mode === 'design' || mode === 'propose' || mode === 'propose-intersection') && designLocation) {
      setCenter({ lat: designLocation.lat, lng: designLocation.lng });
      setZoom((mode === 'propose' || mode === 'propose-intersection') ? 17 : 18);
    }
    // Auto-enable crash data in propose modes
    if (mode === 'propose' || mode === 'propose-intersection') {
      useSafetyDataStore.getState().setEnabled(true);
    }
  }, [mode, designLocation, setCenter, setZoom]);

  // Lock/unlock map context menu
  useEffect(() => {
    setLockedToLocation(mode === 'design');
  }, [mode, setLockedToLocation]);

  // Auto-validate when street changes in design mode
  useEffect(() => {
    if (mode !== 'design' || !currentStreet) {
      return;
    }
    import('@/lib/standards')
      .then(({ validateStreet, loadStandards }) => {
        const standards = loadStandards();
        const results = validateStreet(currentStreet, standards);
        setValidationResults(results);
      })
      .catch(() => {
        // Standards engine not ready
      });
  }, [currentStreet, mode, setValidationResults]);

  // Escape key handler
  useEffect(() => {
    if (mode === 'explore') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'propose') {
          // Save proposal before resetting so it persists on the map
          const proposal = useProposalStore.getState().getProposal();
          if (proposal) useSavedProposalsStore.getState().saveProposal(proposal);
          useProposalStore.getState().reset();
        } else if (mode === 'propose-intersection') {
          useIntersectionStore.getState().reset();
        }
        exitToExplore();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, exitToExplore]);

  // In explore mode, render nothing
  if (mode === 'explore') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <Suspense fallback={null}>
        {/* Configure mode: compact new street form */}
        {mode === 'configure' && <CompactNewStreetForm />}

        {/* Propose mode: guided proposal flow */}
        {mode === 'propose' && <ProposalFlow />}

        {/* Intersection propose mode */}
        {mode === 'propose-intersection' && <IntersectionFlow />}

        {/* Design mode: full HUD */}
        {mode === 'design' && currentStreet && (
          <>
            {/* Left side panel: Element list + Properties */}
            <EditorSidePanel
              visible={showElementPanel}
              side="left"
              title="Elements"
              onClose={toggleElementPanel}
            >
              <ElementList />
              <div className="border-t border-gray-200">
                <ElementProperties />
              </div>
            </EditorSidePanel>

            {/* Right side panel: Validation */}
            <EditorSidePanel
              visible={showValidationPanel}
              side="right"
              title="Validation"
              onClose={toggleValidationPanel}
            >
              <ValidationPanel />
            </EditorSidePanel>

            {/* Bottom dock: Toolbar + Cross-section */}
            <div className="pointer-events-auto">
              <EditorDock />
            </div>

            {/* Template gallery modal */}
            <div className="pointer-events-auto">
              <TemplateGalleryModal />
            </div>

            {/* Floating toggles for hidden panels */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
              {!showElementPanel && (
                <button
                  onClick={toggleElementPanel}
                  className="bg-white/90 backdrop-blur-md text-gray-600 hover:text-gray-900 text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-gray-200 transition-colors"
                >
                  Elements
                </button>
              )}
              {!showValidationPanel && (
                <button
                  onClick={toggleValidationPanel}
                  className="bg-white/90 backdrop-blur-md text-gray-600 hover:text-gray-900 text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-gray-200 transition-colors"
                >
                  Validation
                </button>
              )}
            </div>
          </>
        )}
      </Suspense>
    </div>
  );
}
