import { Suspense, lazy, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStreetStore } from '@/stores/street-store';
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

interface EditorHUDProps {
  googleApi: typeof google | null;
}

/**
 * Orchestrator component: renders floating editor panels on top of the map.
 * Manages which panels are visible based on workspace mode.
 */
export function EditorHUD({ googleApi }: EditorHUDProps) {
  const mode = useWorkspaceStore((s) => s.mode);
  const showElementPanel = useWorkspaceStore((s) => s.showElementPanel);
  const showValidationPanel = useWorkspaceStore((s) => s.showValidationPanel);
  const showStreetViewPip = useWorkspaceStore((s) => s.showStreetViewPip);
  const toggleElementPanel = useWorkspaceStore((s) => s.toggleElementPanel);
  const toggleValidationPanel = useWorkspaceStore((s) => s.toggleValidationPanel);
  const toggleStreetViewPip = useWorkspaceStore((s) => s.toggleStreetViewPip);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);
  const designLocation = useWorkspaceStore((s) => s.designLocation);

  const currentStreet = useStreetStore((s) => s.currentStreet);
  const setValidationResults = useStreetStore((s) => s.setValidationResults);

  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const setLockedToLocation = useMapStore((s) => s.setLockedToLocation);

  // Zoom to design location when entering configure/design mode
  useEffect(() => {
    if ((mode === 'configure' || mode === 'design') && designLocation) {
      setCenter({ lat: designLocation.lat, lng: designLocation.lng });
      setZoom(18);
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

            {/* Street View PiP */}
            {showStreetViewPip && googleApi && (
              <StreetViewPipLazy googleApi={googleApi} />
            )}

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
              <button
                onClick={toggleStreetViewPip}
                className={`backdrop-blur-md text-xs font-medium px-3 py-1.5 rounded-full shadow-md border transition-colors ${
                  showStreetViewPip
                    ? 'bg-blue-500 text-white border-blue-400'
                    : 'bg-white/90 text-gray-600 hover:text-gray-900 border-gray-200'
                }`}
              >
                Street View
              </button>
            </div>
          </>
        )}
      </Suspense>
    </div>
  );
}

// Separate lazy wrapper for StreetViewPip
const StreetViewPipComponent = lazy(() =>
  import('./StreetViewPip').then((m) => ({ default: m.StreetViewPip })),
);

function StreetViewPipLazy({ googleApi }: { googleApi: typeof google }) {
  return (
    <Suspense fallback={null}>
      <div className="pointer-events-auto">
        <StreetViewPipComponent googleApi={googleApi} />
      </div>
    </Suspense>
  );
}
