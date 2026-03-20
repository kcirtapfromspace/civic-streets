import { useEffect, useCallback } from 'react';
import { useMapStore } from './map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface PinDesignFlowProps {
  map: google.maps.Map | null;
  googleApi: typeof google | null;
}

/**
 * Handles map click events to show a context menu with
 * "Design a Street Here" and "Report a Hotspot" options.
 * Reverse-geocodes the clicked location to get a street address.
 */
export function PinDesignFlow({ map, googleApi }: PinDesignFlowProps) {
  const openContextMenu = useMapStore((s) => s.openContextMenu);
  const closeContextMenu = useMapStore((s) => s.closeContextMenu);
  const contextMenuPosition = useMapStore((s) => s.contextMenuPosition);
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation);
  const lockedToLocation = useMapStore((s) => s.lockedToLocation);

  // Handle map clicks
  useEffect(() => {
    if (!map || !googleApi) return;

    const listener = map.addListener(
      'click',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        // Don't show context menu when locked in design mode
        if (useMapStore.getState().lockedToLocation) return;

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        // Convert lat/lng to pixel position for the context menu
        const projection = map.getProjection();
        if (!projection) return;

        const bounds = map.getBounds();
        const topRight = projection.fromLatLngToPoint(
          bounds!.getNorthEast(),
        )!;
        const bottomLeft = projection.fromLatLngToPoint(
          bounds!.getSouthWest(),
        )!;
        const scale = Math.pow(2, map.getZoom()!);
        const point = projection.fromLatLngToPoint(e.latLng)!;

        const mapDiv = map.getDiv();
        const mapRect = mapDiv.getBoundingClientRect();

        const x =
          (point.x - bottomLeft.x) * scale + mapRect.left;
        const y =
          (point.y - topRight.y) * scale + mapRect.top;

        openContextMenu({ lat, lng, x, y });
      },
    );

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, googleApi, openContextMenu]);

  // Close context menu on map drag or zoom
  useEffect(() => {
    if (!map) return;

    const dragListener = map.addListener('dragstart', () => {
      closeContextMenu();
    });
    const zoomListener = map.addListener('zoom_changed', () => {
      closeContextMenu();
    });

    return () => {
      google.maps.event.removeListener(dragListener);
      google.maps.event.removeListener(zoomListener);
    };
  }, [map, closeContextMenu]);

  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      if (!googleApi) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      try {
        const geocoder = new googleApi.maps.Geocoder();
        const result = await geocoder.geocode({
          location: { lat, lng },
        });

        if (result.results[0]) {
          return result.results[0].formatted_address;
        }
      } catch {
        // Fall back to coordinates
      }

      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    },
    [googleApi],
  );

  const enterConfigureMode = useWorkspaceStore((s) => s.enterConfigureMode);

  const handleDesignHere = useCallback(async () => {
    if (!contextMenuPosition) return;

    const { lat, lng } = contextMenuPosition;
    const address = await reverseGeocode(lat, lng);
    const location = { lat, lng, address };
    setSelectedLocation(location);
    closeContextMenu();
    enterConfigureMode(location);
  }, [contextMenuPosition, reverseGeocode, setSelectedLocation, closeContextMenu, enterConfigureMode]);

  const handleReportHotspot = useCallback(async () => {
    if (!contextMenuPosition) return;

    const { lat, lng } = contextMenuPosition;
    const address = await reverseGeocode(lat, lng);
    setSelectedLocation({ lat, lng, address });
    closeContextMenu();

    // TODO: Open hotspot creation form
    // This will be wired up by the community agent
    console.info('[Curbwise] Report a Hotspot:', { lat, lng, address });
  }, [contextMenuPosition, reverseGeocode, setSelectedLocation, closeContextMenu]);

  if (!contextMenuPosition) return null;

  return (
    <div
      className="fixed z-50"
      style={{
        left: contextMenuPosition.x,
        top: contextMenuPosition.y,
      }}
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[220px] animate-in fade-in-0 zoom-in-95">
        <button
          onClick={handleDesignHere}
          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center gap-3 group"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
            </svg>
          </span>
          <div>
            <div className="font-medium text-gray-900 text-sm">
              Design a Street Here
            </div>
            <div className="text-xs text-gray-500">
              Open cross-section editor
            </div>
          </div>
        </button>

        <div className="border-t border-gray-100" />

        <button
          onClick={handleReportHotspot}
          className="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors flex items-center gap-3 group"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 group-hover:bg-red-200 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <div>
            <div className="font-medium text-gray-900 text-sm">
              Report a Hotspot
            </div>
            <div className="text-xs text-gray-500">
              Flag a safety concern
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
