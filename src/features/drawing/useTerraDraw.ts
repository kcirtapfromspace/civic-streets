import { useEffect, useRef, useCallback } from 'react';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawCircleMode,
  TerraDrawFreehandMode,
  TerraDrawSelectMode,
  TerraDrawRenderMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type maplibregl from 'maplibre-gl';
import type { DrawingMode } from '@/stores/drawing-store';

interface UseTerraDraw {
  setMode: (mode: DrawingMode) => void;
  clear: () => void;
}

interface UseTerraDraw_Options {
  map: maplibregl.Map | null;
  enabled: boolean;
  onLineFinish?: (coords: Array<{ lat: number; lng: number }>) => void;
  onCircleFinish?: (center: { lat: number; lng: number }, radiusKm: number, coords: Array<{ lat: number; lng: number }>) => void;
  onFreehandFinish?: (coords: Array<{ lat: number; lng: number }>) => void;
}

export function useTerraDraw({
  map,
  enabled,
  onLineFinish,
  onCircleFinish,
  onFreehandFinish,
}: UseTerraDraw_Options): UseTerraDraw {
  const drawRef = useRef<TerraDraw | null>(null);

  useEffect(() => {
    if (!map || !enabled) {
      if (drawRef.current) {
        drawRef.current.stop();
        drawRef.current = null;
      }
      return;
    }

    const adapter = new TerraDrawMapLibreGLAdapter({ map });

    const draw = new TerraDraw({
      adapter,
      modes: [
        new TerraDrawLineStringMode(),
        new TerraDrawCircleMode(),
        new TerraDrawFreehandMode(),
        new TerraDrawSelectMode({
          flags: {
            linestring: { feature: { draggable: false, coordinates: {} } },
            circle: { feature: { draggable: false, coordinates: {} } },
            freehand: { feature: { draggable: false, coordinates: {} } },
          },
        }),
        new TerraDrawRenderMode({ modeName: 'default', styles: {} }),
      ],
    });

    draw.start();
    draw.setMode('default');

    draw.on('finish', (id: string | number, _context: { mode: string; action: string }) => {
      const snapshot = draw.getSnapshot();
      const feature = snapshot.find((f) => f.id === id);
      if (!feature) return;

      const geomType = feature.geometry.type;

      if (geomType === 'LineString') {
        const coords = (feature.geometry as GeoJSON.LineString).coordinates.map(
          ([lng, lat]) => ({ lat, lng }),
        );
        onLineFinish?.(coords);
      } else if (geomType === 'Polygon') {
        // Circle mode produces a polygon; extract center from properties
        const polyCoords = (feature.geometry as GeoJSON.Polygon).coordinates[0];
        const coords = polyCoords.map(([lng, lat]) => ({ lat, lng }));

        // Compute centroid for circle center
        const sumLat = coords.reduce((s, c) => s + c.lat, 0);
        const sumLng = coords.reduce((s, c) => s + c.lng, 0);
        const center = { lat: sumLat / coords.length, lng: sumLng / coords.length };

        // Approximate radius from center to first point (km)
        const R = 6371;
        const dLat = ((coords[0].lat - center.lat) * Math.PI) / 180;
        const dLng = ((coords[0].lng - center.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((center.lat * Math.PI) / 180) *
          Math.cos((coords[0].lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
        const radiusKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (feature.properties?.mode === 'circle') {
          onCircleFinish?.(center, radiusKm, coords);
        } else {
          // Freehand produces a polygon too
          onFreehandFinish?.(coords);
        }
      }
    });

    drawRef.current = draw;

    return () => {
      draw.stop();
      drawRef.current = null;
    };
  }, [map, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = useCallback((mode: DrawingMode) => {
    if (!drawRef.current) return;
    const modeMap: Record<DrawingMode, string> = {
      cursor: 'default',
      line: 'linestring',
      circle: 'circle',
      freehand: 'freehand',
    };
    drawRef.current.setMode(modeMap[mode]);
  }, []);

  const clear = useCallback(() => {
    if (!drawRef.current) return;
    drawRef.current.clear();
  }, []);

  return { setMode, clear };
}
