import { useRef, useCallback, useEffect, useState } from 'react';
import { useMapStore } from './map-store';
import { useGoogleMaps } from './useGoogleMaps';
import { MapControls } from './MapControls';
import { EarthView } from './EarthView';
import { PinDesignFlow } from './PinDesignFlow';
import { CommunityPinsLayer } from './CommunityPinsLayer';
import { EditorHUD } from './EditorHUD';
import { MapOverlay as ProposalMapOverlay } from '@/features/proposal/MapOverlay';

/**
 * MapView — full-viewport Google Maps wrapper.
 * The primary navigation experience for Curbwise.
 *
 * If VITE_GOOGLE_MAPS_API_KEY is not set, shows a helpful setup message.
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

  const [mapElement, setMapElement] = useRefCallback();

  const { map, isLoaded, error, google: googleApi } = useGoogleMaps({
    mapElement,
    center,
    zoom,
    mapType,
    mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID,
  });

  // Sync map movements back to store
  useEffect(() => {
    if (!map) return;

    const idleListener = map.addListener('idle', () => {
      const c = map.getCenter();
      const z = map.getZoom();
      if (c) {
        setCenter({ lat: c.lat(), lng: c.lng() });
      }
      if (z !== undefined) {
        setZoom(z);
      }
    });

    return () => {
      google.maps.event.removeListener(idleListener);
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

  // Missing API key fallback
  if (error === 'VITE_GOOGLE_MAPS_API_KEY') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-blue-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="w-8 h-8 text-blue-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Map Setup Required
          </h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Set{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-blue-700">
              VITE_GOOGLE_MAPS_API_KEY
            </code>{' '}
            in your{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
              .env
            </code>{' '}
            file to enable the map.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 text-left">
            <code className="text-sm text-gray-300 block">
              <span className="text-gray-500"># .env</span>
              <br />
              <span className="text-green-400">
                VITE_GOOGLE_MAPS_API_KEY
              </span>
              =your_api_key_here
              <br />
              <span className="text-green-400">
                VITE_GOOGLE_MAPS_MAP_ID
              </span>
              =optional_map_id
            </code>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Enable Maps JavaScript API, Places API, and Geocoding API in the
            Google Cloud Console.
          </p>
        </div>
      </div>
    );
  }

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
      {isLoaded && (
        <>
          <MapControls map={map} googleApi={googleApi} />
          <EarthView map={map} enabled={is3D} />
          <PinDesignFlow map={map} googleApi={googleApi} />
          <CommunityPinsLayer map={map} googleApi={googleApi} />
          <ProposalMapOverlay map={map} />
          <EditorHUD googleApi={googleApi} />
        </>
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
