import { useRef, useCallback, useEffect, useState } from 'react';
import { useMapStore } from './map-store';
import { useMapLibre, isProgrammaticMove } from './useMapLibre';
import { MapControls } from './MapControls';
import { EarthView } from './EarthView';
import { PinDesignFlow } from './PinDesignFlow';
import { CommunityPinsLayer } from './CommunityPinsLayer';
import { EditorHUD } from './EditorHUD';
import { MapOverlay as ProposalMapOverlay } from '@/features/proposal/MapOverlay';
import { SavedProposalsLayer } from '@/features/proposal/SavedProposalsLayer';
import { DrawingLayer } from '@/features/drawing/DrawingLayer';
import { DrawingToolbar } from '@/features/drawing/DrawingToolbar';
import { DrawingActionCard } from '@/features/drawing/DrawingActionCard';
import { CrashDataLayer } from '@/features/safety-data/CrashDataLayer';
import { IssueReportForm } from '@/features/community/IssueReportForm';
import { useCreateHotspot } from '@/lib/api/use-hotspots';
import { issueGroupToLegacyCategory } from '@/lib/types/community';

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

  const [mapElement, setMapElement] = useRefCallback();

  const { map, isLoaded, error } = useMapLibre({
    mapElement,
    center,
    zoom,
    mapType,
  });

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

    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
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

  // Generic error fallback
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="w-8 h-8 text-red-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Map Error
          </h2>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading map...</span>
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

      {/* Map overlay components — only render when loaded */}
      {isLoaded && map && (
        <>
          <MapControls map={map} />
          <EarthView map={map} enabled={is3D} />
          <PinDesignFlow map={map} />
          <CommunityPinsLayer map={map} />
          <SavedProposalsLayer map={map} />
          <ProposalMapOverlay map={map} />
          <DrawingLayer map={map} />
          <DrawingToolbar />
          <DrawingActionCard />
          <CrashDataLayer map={map} />
          <EditorHUD />
        </>
      )}

      {/* Floating issue report form */}
      {reportFormOpen && reportFormLocation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="max-h-[90vh] overflow-y-auto">
            <IssueReportForm
              initialAddress={reportFormLocation.address}
              initialLat={reportFormLocation.lat}
              initialLng={reportFormLocation.lng}
              onSubmit={async (data) => {
                try {
                  await createHotspot({
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
                } catch (err) {
                  console.error('[MapView] Failed to create hotspot:', err);
                }
                closeReportForm();
              }}
              onCancel={closeReportForm}
            />
          </div>
        </div>
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
