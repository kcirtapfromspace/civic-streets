import { useRef, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { useMapStore } from './map-store';
import { initializeMapLocation } from './initial-location';
import { useMapLibre, isProgrammaticMove } from './useMapLibre';
import { MapControls } from './MapControls';
import { EarthView } from './EarthView';
import { PinDesignFlow } from './PinDesignFlow';
import { CommunityPinsLayer } from './CommunityPinsLayer';
import { ServiceAreaLayer } from './ServiceAreaLayer';
import { EditorHUD } from './EditorHUD';
import { MapOverlay as ProposalMapOverlay } from '@/features/proposal/MapOverlay';
import { SavedProposalsLayer } from '@/features/proposal/SavedProposalsLayer';
import { DrawingLayer } from '@/features/drawing/DrawingLayer';
import { DrawingToolbar } from '@/features/drawing/DrawingToolbar';
import { DrawingActionCard } from '@/features/drawing/DrawingActionCard';
import { CrashDataLayer } from '@/features/safety-data/CrashDataLayer';
import { IssueReportForm } from '@/features/community/IssueReportForm';
import { useCreateHotspot, useHotspotById } from '@/lib/api/use-hotspots';
import { useStartProposal } from '@/features/proposal/useStartProposal';
import { convexAvailable } from '@/lib/api/convex-provider';
import { issueGroupToLegacyCategory } from '@/lib/types/community';
import { LocationFallback } from './LocationFallback';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { StreetPlacement } from './StreetPlacement';

/**
 * MapView — full-viewport MapLibre GL wrapper.
 * The primary navigation experience for Curbwise.
 */
export function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);
  const mapType = useMapStore((s) => s.mapType);
  const is3D = useMapStore((s) => s.is3D);
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const closeContextMenu = useMapStore((s) => s.closeContextMenu);
  const reportFormOpen = useMapStore((s) => s.reportFormOpen);
  const reportFormLocation = useMapStore((s) => s.reportFormLocation);
  const closeReportForm = useMapStore((s) => s.closeReportForm);
  const createHotspot = useCreateHotspot();
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const { hotspot: savedObservation, isLoading: isSavedObservationLoading } = useHotspotById(savedReportId ?? undefined);
  const { startProposal, confirmation } = useStartProposal();
  const [manualLocation, setManualLocation] = useState(false);
  const [dismissedMapError, setDismissedMapError] = useState<string | null>(null);
  const mode = useWorkspaceStore((state) => state.mode);

  const [mapElement, setMapElement] = useRefCallback();

  const { map, isLoaded, error } = useMapLibre({
    mapElement,
    center,
    zoom,
    mapType,
  });

  useEffect(() => { void initializeMapLocation(); }, []);

  // Sync map movements back to store
  useEffect(() => {
    if (!map) return;

    const onMoveEnd = () => {
      // Skip writeback during programmatic moves to avoid
      // overwriting pending store values (e.g. search result center)
      if (isProgrammaticMove) return;
      const c = map.getCenter();
      const z = map.getZoom();
      setCenter({ lat: c.lat, lng: c.lng });
      setZoom(z);
    };

    const onMoveStart = (event: { originalEvent?: Event }) => {
      if (event.originalEvent) useMapStore.setState({ initialLocationStatus: 'skipped' });
    };
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
      map.off('movestart', onMoveStart);
    };
  }, [map, setCenter, setZoom]);

  // Close context menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeContextMenu]);


  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {!isLoaded && !error && !manualLocation && mode === 'explore' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading map...</span>
            <button type="button" onClick={() => setManualLocation(true)} className="min-h-11 text-sm text-civic-ink underline">Describe a location instead</button>
          </div>
        </div>
      )}

      {/* Map container */}
      <div
        ref={(el) => {
          mapContainerRef.current = el;
          setMapElement(el);
        }}
        className="w-full h-full"
      />

      {(manualLocation || (error && error !== dismissedMapError && mode === 'explore')) && <LocationFallback error={error} onClose={() => { setManualLocation(false); setDismissedMapError(error); }} />}
      {error && error === dismissedMapError && mode === 'explore' && <button type="button" onClick={() => setManualLocation(true)} className="absolute bottom-4 left-4 z-20 min-h-11 border border-civic-line bg-white px-3 text-sm text-civic-ink">Map unavailable · Describe a location</button>}

      {/* Map overlay components — only render when loaded */}
      {isLoaded && map && (
        <>
          <MapControls map={map} />
          <EarthView map={map} enabled={is3D} />
          <PinDesignFlow map={map} />
          {mode !== 'place-street' && <CommunityPinsLayer map={map} />}
          <ServiceAreaLayer map={map} />
          <SavedProposalsLayer map={map} />
          <ProposalMapOverlay map={map} />
          {mode !== 'place-street' && <DrawingLayer map={map} />}
          <DrawingToolbar />
          {mode === 'explore' && <DrawingActionCard />}
          <CrashDataLayer map={map} />

        </>
      )}

      <EditorHUD />
      {mode === 'place-street' && <StreetPlacement map={isLoaded ? map : null} error={error} />}

      {/* Floating issue report form */}
      {savedReportId && !reportFormOpen && (
        <div role="status" className="absolute left-4 right-4 top-4 z-30 max-w-md rounded-lg border border-civic-line bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              {convexAvailable ? 'Observation saved' : 'Demo observation saved'}
            </p>
            <button type="button" onClick={() => setSavedReportId(null)} aria-label="Dismiss saved observation" className="min-h-11 min-w-11 rounded px-2 text-slate-500 hover:text-slate-900 focus-visible:outline-2">
              ×
            </button>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {convexAvailable
              ? 'Your observation is on the public map.'
              : 'Your observation is available in this browser session only and disappears on reload. It has not been published.'}
          </p>
          <Link to={`/hotspot/${encodeURIComponent(savedReportId)}`} className="mt-2 inline-block text-sm font-medium text-civic-ink underline underline-offset-4">
            View observation
          </Link>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!savedObservation} onClick={() => {
              if (!savedObservation) return;
              startProposal({
                streetName: savedObservation.address.split(',')[0].trim() || savedObservation.title,
                location: { lat: savedObservation.lat, lng: savedObservation.lng, address: savedObservation.address },
                observation: {
                  id: savedObservation.id, title: savedObservation.title, description: savedObservation.description,
                  photoUrls: [...savedObservation.photoUrls], lat: savedObservation.lat, lng: savedObservation.lng,
                  address: savedObservation.address, createdAt: savedObservation.createdAt,
                  source: convexAvailable ? 'community' : 'browser-session',
                },
                onStarted: () => setSavedReportId(null),
              });
            }} className="min-h-11 rounded-sm bg-civic-ink px-3 text-sm font-medium text-white disabled:opacity-50">
              Explore a change here
            </button>
            <button type="button" onClick={() => setSavedReportId(null)} className="min-h-11 rounded-sm border border-civic-line px-3 text-sm font-medium text-civic-ink">Done</button>
          </div>
          {!savedObservation && <p className="mt-2 text-xs text-slate-600">{isSavedObservationLoading ? 'Loading your saved observation…' : 'Open the observation to continue when it becomes available.'}</p>}
        </div>
      )}
      {confirmation}
      {reportFormOpen && reportFormLocation && (
        <Modal isOpen onClose={closeReportForm} title="Mark a problem" dismissible={false}>
          <IssueReportForm
            initialAddress={reportFormLocation.address}
            initialLat={reportFormLocation.lat}
            initialLng={reportFormLocation.lng}
            onSubmit={async (data) => {
              const hotspotId = await createHotspot({
                reportAssistanceId: data.reportAssistanceId,
                title: data.title,
                description: data.description,
                category: issueGroupToLegacyCategory(data.group),
                severity: data.severity,
                lat: data.location.lat,
                lng: data.location.lng,
                address: data.location.address,
                photoUrls: data.photoDataUrls,
                issueGroup: data.group,
                issueType: data.issueType,
                isBlocking: data.isBlocking,
                processedImages: data.processedImages,
                honeypotValue: data.honeypotValue,
                formOpenedAt: data.formOpenedAt,
              });
              if (!hotspotId) throw new Error('Your observation was not saved. Please try again.');
              setSavedReportId(hotspotId);
              closeReportForm();
            }}
            onCancel={closeReportForm}
          />
        </Modal>
      )}
    </div>
  );
}

/**
 * Utility hook: ref callback that stores the element in state
 * so that it can be used as a dependency in useEffect.
 */
function useRefCallback(): [
  HTMLDivElement | null,
  (el: HTMLDivElement | null) => void,
] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    setElement(el);
  }, []);
  return [element, ref];
}

// Default export for React.lazy() compatibility
export default MapView;
