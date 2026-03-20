import { useCallback } from 'react';
import type maplibregl from 'maplibre-gl';
import { useDrawingStore } from '@/stores/drawing-store';
import { useTerraDraw } from './useTerraDraw';
import { snapToRoad } from '@/features/proposal/utils/road-snap';
import { fetchRoadPath } from '@/features/proposal/utils/road-geometry';

interface DrawingLayerProps {
  map: maplibregl.Map | null;
}

export function DrawingLayer({ map }: DrawingLayerProps) {
  const activeMode = useDrawingStore((s) => s.activeMode);
  const addGeometry = useDrawingStore((s) => s.addGeometry);
  const updateGeometrySnapped = useDrawingStore((s) => s.updateGeometrySnapped);
  const setIsSnapping = useDrawingStore((s) => s.setIsSnapping);

  const handleLineFinish = useCallback(
    async (coords: Array<{ lat: number; lng: number }>) => {
      const id = crypto.randomUUID();
      addGeometry({ id, mode: 'line', rawCoords: coords, snappedCoords: null });

      // Snap to road via OSRM Match
      setIsSnapping(true);
      try {
        const snapped = await snapToRoad(coords);
        updateGeometrySnapped(id, snapped);
      } finally {
        setIsSnapping(false);
      }
    },
    [addGeometry, updateGeometrySnapped, setIsSnapping],
  );

  const handleCircleFinish = useCallback(
    async (
      center: { lat: number; lng: number },
      radiusKm: number,
      coords: Array<{ lat: number; lng: number }>,
    ) => {
      const id = crypto.randomUUID();
      addGeometry({
        id,
        mode: 'circle',
        rawCoords: coords,
        snappedCoords: null,
        center,
        radiusMeters: radiusKm * 1000,
      });

      // Fetch road through center
      setIsSnapping(true);
      try {
        const { path } = await fetchRoadPath(center);
        updateGeometrySnapped(id, path);
      } finally {
        setIsSnapping(false);
      }
    },
    [addGeometry, updateGeometrySnapped, setIsSnapping],
  );

  const handleFreehandFinish = useCallback(
    (coords: Array<{ lat: number; lng: number }>) => {
      const id = crypto.randomUUID();
      // Freehand mode: no snapping, store raw polyline
      addGeometry({ id, mode: 'freehand', rawCoords: coords, snappedCoords: null });
    },
    [addGeometry],
  );

  const { setMode, clear } = useTerraDraw({
    map,
    enabled: activeMode !== 'cursor',
    onLineFinish: handleLineFinish,
    onCircleFinish: handleCircleFinish,
    onFreehandFinish: handleFreehandFinish,
  });

  // Sync Terra Draw mode when store changes
  // This is handled by useTerraDraw re-initializing when enabled changes,
  // and setMode for mode switches within an active session
  if (activeMode !== 'cursor') {
    setMode(activeMode);
  }

  return null;
}
