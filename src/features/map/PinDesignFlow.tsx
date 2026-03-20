import { useEffect, useCallback } from 'react';
import type maplibregl from 'maplibre-gl';
import { useMapStore } from './map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useDrawingStore } from '@/stores/drawing-store';

interface PinDesignFlowProps {
  map: maplibregl.Map | null;
}

/**
 * Handles map click events to show a context menu with
 * "Design a Street Here" and "Report a Hotspot" options.
 * Reverse-geocodes the clicked location via Nominatim.
 */
export function PinDesignFlow({ map }: PinDesignFlowProps) {
  const openContextMenu = useMapStore((s) => s.openContextMenu);
  const closeContextMenu = useMapStore((s) => s.closeContextMenu);
  const contextMenuPosition = useMapStore((s) => s.contextMenuPosition);
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation);

  // Handle map clicks
  useEffect(() => {
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      // Don't open context menu when drawing tools are active
      if (useDrawingStore.getState().activeMode !== 'cursor') return;
      if (useMapStore.getState().lockedToLocation) return;

      const { lat, lng } = e.lngLat;
      const point = map.project(e.lngLat);
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();

      openContextMenu({
        lat,
        lng,
        x: point.x + rect.left,
        y: point.y + rect.top,
      });
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, openContextMenu]);

  // Close context menu on map drag or zoom
  useEffect(() => {
    if (!map) return;

    const onDragStart = () => closeContextMenu();
    const onZoom = () => closeContextMenu();

    map.on('dragstart', onDragStart);
    map.on('zoom', onZoom);

    return () => {
      map.off('dragstart', onDragStart);
      map.off('zoom', onZoom);
    };
  }, [map, closeContextMenu]);

  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.display_name) {
          return data.display_name;
        }
      } catch {
        // Fall back to coordinates
      }
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    },
    [],
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
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.06] py-2 min-w-[230px] animate-scale-in">
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
