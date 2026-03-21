import { useCallback, useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';

interface DrawingToolProps {
  map: maplibregl.Map;
  onPolygonComplete: (polygon: [number, number][]) => void;
  onClear: () => void;
}

const SOURCE_ID = 'drawing-polygon-source';
const FILL_LAYER_ID = 'drawing-polygon-fill';
const LINE_LAYER_ID = 'drawing-polygon-line';
const VERTEX_LAYER_ID = 'drawing-polygon-vertices';

function getGeoJSON(vertices: [number, number][], closed: boolean) {
  const features: GeoJSON.Feature[] = [];

  // Polygon fill + outline (need at least 3 points and closed)
  if (vertices.length >= 3 && closed) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[...vertices, vertices[0]]],
      },
    });
  } else if (vertices.length >= 2) {
    // Line while drawing
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: vertices,
      },
    });
  }

  // Vertex points
  for (const v of vertices) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: v },
    });
  }

  return { type: 'FeatureCollection' as const, features };
}

export function DrawingTool({ map, onPolygonComplete, onClear }: DrawingToolProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);
  const verticesRef = useRef<[number, number][]>([]);

  const updateSource = useCallback(
    (closed = false) => {
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(getGeoJSON(verticesRef.current, closed));
      }
    },
    [map],
  );

  const cleanup = useCallback(() => {
    if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getLayer(VERTEX_LAYER_ID)) map.removeLayer(VERTEX_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    map.getCanvas().style.cursor = '';
  }, [map]);

  const initLayers = useCallback(() => {
    if (map.getSource(SOURCE_ID)) return;

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.15,
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: ['any', ['==', '$type', 'Polygon'], ['==', '$type', 'LineString']],
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    });

    map.addLayer({
      id: VERTEX_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#3b82f6',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }, [map]);

  // Handle click to add vertex
  useEffect(() => {
    if (!isDrawing) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      verticesRef.current = [...verticesRef.current, [e.lngLat.lng, e.lngLat.lat]];
      updateSource(false);
    };

    const handleDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      if (verticesRef.current.length >= 3) {
        updateSource(true);
        setIsDrawing(false);
        setHasPolygon(true);
        map.getCanvas().style.cursor = '';
        onPolygonComplete([...verticesRef.current]);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        verticesRef.current = [];
        updateSource(false);
        cleanup();
        setIsDrawing(false);
        setHasPolygon(false);
        onClear();
      }
    };

    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawing, map, onPolygonComplete, onClear, updateSource, cleanup]);

  const startDrawing = () => {
    verticesRef.current = [];
    setHasPolygon(false);
    initLayers();
    updateSource(false);
    map.getCanvas().style.cursor = 'crosshair';
    map.doubleClickZoom.disable();
    setIsDrawing(true);
  };

  const clearDrawing = () => {
    verticesRef.current = [];
    cleanup();
    setIsDrawing(false);
    setHasPolygon(false);
    map.doubleClickZoom.enable();
    onClear();
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={isDrawing ? clearDrawing : startDrawing}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          isDrawing
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 shadow hover:bg-gray-50'
        }`}
      >
        {isDrawing ? 'Cancel' : 'Draw area'}
      </button>
      {hasPolygon && !isDrawing && (
        <button
          onClick={clearDrawing}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
