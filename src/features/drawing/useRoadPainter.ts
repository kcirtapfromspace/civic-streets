import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useDrawingStore } from '@/stores/drawing-store';
import { useStyleReload } from '@/features/map/useStyleReload';
import { snapToRoad } from '@/features/proposal/utils/road-snap';
import { fetchRoadPath } from '@/features/proposal/utils/road-geometry';

type LatLng = { lat: number; lng: number };

const TRAIL_SOURCE = 'road-painter-trail';
const TRAIL_LAYER = 'road-painter-trail-line';
const TRAIL_GLOW_LAYER = 'road-painter-trail-glow';
const SELECTED_SOURCE = 'road-painter-selected';
const SELECTED_GLOW_LAYER = 'road-painter-selected-glow';
const SELECTED_LINE_LAYER = 'road-painter-selected-line';

const MIN_POINT_DISTANCE = 0.00008; // ~9m — filters jitter while painting

/** Reverse-geocode a point via Nominatim to get the street name. */
async function reverseGeocodeStreetName(point: LatLng): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lng}&zoom=17&addressdetails=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.address?.road ?? null;
  } catch {
    return null;
  }
}

function removeLayerSafe(map: maplibregl.Map, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
}

function removeSourceSafe(map: maplibregl.Map, id: string) {
  if (map.getSource(id)) map.removeSource(id);
}

function cleanupTrail(map: maplibregl.Map) {
  removeLayerSafe(map, TRAIL_GLOW_LAYER);
  removeLayerSafe(map, TRAIL_LAYER);
  removeSourceSafe(map, TRAIL_SOURCE);
}

function cleanupSelected(map: maplibregl.Map) {
  removeLayerSafe(map, SELECTED_GLOW_LAYER);
  removeLayerSafe(map, SELECTED_LINE_LAYER);
  removeSourceSafe(map, SELECTED_SOURCE);
}

/**
 * Manages the drag-to-paint interaction on the map.
 *
 * For 'road' tool: mousedown → drag to paint trail → mouseup → OSRM snap
 * For 'newroad' tool: same but no snapping
 * For 'intersection' tool: click → fetchRoadPath through center
 *
 * The drag trail is managed imperatively (ref + direct MapLibre source updates)
 * for 60fps performance. The selected path uses React effects.
 */
export function useRoadPainter(map: maplibregl.Map | null) {
  const activeTool = useDrawingStore((s) => s.activeTool);
  const selectedPath = useDrawingStore((s) => s.selectedPath);
  const styleVersion = useStyleReload(map);

  // Imperative trail state (not in React/Zustand for performance)
  const trailRef = useRef<LatLng[]>([]);
  const isDraggingRef = useRef(false);

  // ── Road + New Road: drag-to-paint ──────────────────────────────
  useEffect(() => {
    if (!map || (activeTool !== 'road' && activeTool !== 'newroad')) return;

    const store = useDrawingStore;
    const canvas = map.getCanvas();
    canvas.style.cursor = 'crosshair';

    const initTrailLayer = () => {
      cleanupTrail(map);
      const color = activeTool === 'newroad' ? '#8B5CF6' : '#3B82F6';

      map.addSource(TRAIL_SOURCE, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });

      map.addLayer({
        id: TRAIL_GLOW_LAYER,
        type: 'line',
        source: TRAIL_SOURCE,
        paint: {
          'line-color': color,
          'line-width': 14,
          'line-opacity': 0.12,
          'line-blur': 6,
        },
      });

      map.addLayer({
        id: TRAIL_LAYER,
        type: 'line',
        source: TRAIL_SOURCE,
        paint: {
          'line-color': color,
          'line-width': 4,
          'line-opacity': 0.8,
          'line-dasharray': [3, 2],
        },
      });
    };

    const updateTrailData = () => {
      const source = map.getSource(TRAIL_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: trailRef.current.map((p) => [p.lng, p.lat]),
          },
          properties: {},
        });
      }
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return; // left-click only
      e.preventDefault();

      isDraggingRef.current = true;
      trailRef.current = [{ lat: e.lngLat.lat, lng: e.lngLat.lng }];
      store.getState().setIsDragging(true);
      store.getState().setSelectedPath(null);

      map.dragPan.disable();

      if (map.isStyleLoaded()) {
        initTrailLayer();
      }
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isDraggingRef.current) return;

      const point = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const last = trailRef.current[trailRef.current.length - 1];

      // Distance filter: skip points too close together
      if (last) {
        const dLat = point.lat - last.lat;
        const dLng = point.lng - last.lng;
        if (Math.sqrt(dLat * dLat + dLng * dLng) < MIN_POINT_DISTANCE) return;
      }

      trailRef.current.push(point);
      updateTrailData();
    };

    const onMouseUp = async () => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      map.dragPan.enable();
      cleanupTrail(map);

      const trail = [...trailRef.current];
      trailRef.current = [];

      if (trail.length < 3) {
        store.getState().setIsDragging(false);
        return;
      }

      if (activeTool === 'road') {
        store.getState().setIsSnapping(true);
        try {
          const snapped = await snapToRoad(trail);
          store.getState().setSelectedPath(snapped);

          // Reverse-geocode the midpoint to get the street name
          const mid = snapped[Math.floor(snapped.length / 2)];
          reverseGeocodeStreetName(mid).then((name) => {
            if (name) store.getState().setStreetName(name);
          });
        } catch {
          store.getState().setSelectedPath(trail);
        } finally {
          store.getState().setIsSnapping(false);
        }
      } else {
        store.getState().setSelectedPath(trail);
      }
    };

    const onContextMenu = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        map.dragPan.enable();
        cleanupTrail(map);
        trailRef.current = [];
        store.getState().clear();
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    map.on('contextmenu', onContextMenu);

    return () => {
      canvas.style.cursor = '';
      map.dragPan.enable();
      isDraggingRef.current = false;
      trailRef.current = [];
      cleanupTrail(map);
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.off('contextmenu', onContextMenu);
    };
  }, [map, activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Intersection: click to mark ─────────────────────────────────
  useEffect(() => {
    if (!map || activeTool !== 'intersection') return;

    const canvas = map.getCanvas();
    canvas.style.cursor = 'pointer';

    const onClick = async (e: maplibregl.MapMouseEvent) => {
      const center = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const store = useDrawingStore.getState();

      store.setIsSnapping(true);
      try {
        const { path } = await fetchRoadPath(center);
        store.setSelectedPath(path);
      } catch {
        store.setIsSnapping(false);
      }
    };

    map.on('click', onClick);
    return () => {
      canvas.style.cursor = '';
      map.off('click', onClick);
    };
  }, [map, activeTool]);

  // ── ESC key: cancel / deactivate ────────────────────────────────
  useEffect(() => {
    if (!map) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const state = useDrawingStore.getState();

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        map.dragPan.enable();
        cleanupTrail(map);
        trailRef.current = [];
        state.clear();
      } else if (state.selectedPath) {
        state.clear();
      } else if (state.activeTool !== 'select') {
        state.setActiveTool('select');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [map]);

  // ── Render selected path layers ─────────────────────────────────
  useEffect(() => {
    if (!map) return;

    cleanupSelected(map);
    if (!selectedPath || selectedPath.length < 2) return;

    const isNewRoad = activeTool === 'newroad';
    const color = isNewRoad ? '#8B5CF6' : '#3B82F6';

    const addLayers = () => {
      if (map.getSource(SELECTED_SOURCE)) return;

      map.addSource(SELECTED_SOURCE, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: selectedPath.map((p) => [p.lng, p.lat]),
          },
          properties: {},
        },
      });

      map.addLayer({
        id: SELECTED_GLOW_LAYER,
        type: 'line',
        source: SELECTED_SOURCE,
        paint: {
          'line-color': color,
          'line-width': 20,
          'line-opacity': 0.15,
          'line-blur': 10,
        },
      });

      map.addLayer({
        id: SELECTED_LINE_LAYER,
        type: 'line',
        source: SELECTED_SOURCE,
        paint: {
          'line-color': color,
          'line-width': 5,
          'line-opacity': 0.9,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once('styledata', addLayers);
    }

    return () => cleanupSelected(map);
  }, [map, selectedPath, activeTool, styleVersion]);
}
