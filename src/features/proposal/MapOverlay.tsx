import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ELEMENT_COLORS } from '@/lib/constants/colors';
import { offsetPolyline, computeElementOffsets } from './utils/offset-polyline';
import type { CrossSectionElement, ElementType } from '@/lib/types';

interface MapOverlayProps {
  map: maplibregl.Map | null;
}

const HIGHLIGHT_SOURCE = 'proposal-highlight';
const HIGHLIGHT_LAYER = 'proposal-highlight-line';
const ELEMENTS_SOURCE = 'proposal-elements';
const ELEMENTS_LAYER_PREFIX = 'proposal-element-';

/**
 * Renders street cross-section elements on the map as filled polygon strips.
 * Each element becomes a real-world-width polygon that follows the road geometry,
 * not a pixel-width polyline. This makes overlays integrate visually with the road.
 */
export function MapOverlay({ map }: MapOverlayProps) {
  const mode = useWorkspaceStore((s) => s.mode);
  const roadPath = useProposalStore((s) => s.roadPath);
  const beforeStreet = useProposalStore((s) => s.beforeStreet);
  const afterStreet = useProposalStore((s) => s.afterStreet);
  const showBeforeOnMap = useProposalStore((s) => s.showBeforeOnMap);
  const step = useProposalStore((s) => s.step);

  const layerIdsRef = useRef<string[]>([]);

  // Cleanup all layers/sources
  useEffect(() => {
    return () => {
      if (!map) return;
      cleanupLayers(map, layerIdsRef.current);
      cleanupSource(map, HIGHLIGHT_SOURCE);
      cleanupSource(map, ELEMENTS_SOURCE);
    };
  }, [map]);

  // Draw road highlight + element polygons
  useEffect(() => {
    if (!map) return;

    // Always clean up previous render
    cleanupLayers(map, layerIdsRef.current);
    cleanupSource(map, HIGHLIGHT_SOURCE);
    cleanupSource(map, ELEMENTS_SOURCE);
    layerIdsRef.current = [];

    if (roadPath.length < 2 || mode !== 'propose') return;

    const render = () => {
      // Guard: if style reloaded, sources may already be gone
      if (!map.isStyleLoaded()) return;

      // --- Road highlight (blue centerline) ---
      const highlightGeoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: roadPath.map((p) => [p.lng, p.lat]),
          },
          properties: {},
        }],
      };

      map.addSource(HIGHLIGHT_SOURCE, { type: 'geojson', data: highlightGeoJSON });
      map.addLayer({
        id: HIGHLIGHT_LAYER,
        type: 'line',
        source: HIGHLIGHT_SOURCE,
        paint: {
          'line-color': '#3B82F6',
          'line-width': 4,
          'line-opacity': 0.4,
        },
      });
      layerIdsRef.current.push(HIGHLIGHT_LAYER);

      // --- Element polygon fills ---
      const street = (step === 'review' || step === 'transform-selected')
        ? (showBeforeOnMap ? beforeStreet : afterStreet)
        : beforeStreet;

      if (!street) return;

      const offsets = computeElementOffsets(street.elements, street.totalROWWidth);

      const features: GeoJSON.Feature[] = [];
      const newLayerIds: string[] = [HIGHLIGHT_LAYER];

      street.elements.forEach((element: CrossSectionElement, i: number) => {
        const { centerOffset, width } = offsets[i];
        const colors = ELEMENT_COLORS[element.type as ElementType];
        if (!colors) return;

        // Compute inner and outer edge polylines
        const innerOffset = centerOffset - width / 2;
        const outerOffset = centerOffset + width / 2;
        const innerEdge = offsetPolyline(roadPath, innerOffset);
        const outerEdge = offsetPolyline(roadPath, outerOffset);

        // Build a polygon: inner edge forward, outer edge reversed, close the ring
        const ring = [
          ...innerEdge.map((p) => [p.lng, p.lat] as [number, number]),
          ...outerEdge.reverse().map((p) => [p.lng, p.lat] as [number, number]),
        ];
        // Close the ring
        if (ring.length > 0) {
          ring.push(ring[0]);
        }

        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {
            elementIndex: i,
            elementType: element.type,
            fillColor: colors.fill,
            strokeColor: colors.stroke,
          },
        });
      });

      const elementsGeoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      map.addSource(ELEMENTS_SOURCE, { type: 'geojson', data: elementsGeoJSON });

      // Add a fill layer for each element (for per-element coloring)
      features.forEach((feature, i) => {
        const props = feature.properties!;
        const fillId = `${ELEMENTS_LAYER_PREFIX}fill-${i}`;
        const strokeId = `${ELEMENTS_LAYER_PREFIX}stroke-${i}`;

        map.addLayer({
          id: fillId,
          type: 'fill',
          source: ELEMENTS_SOURCE,
          filter: ['==', ['get', 'elementIndex'], props.elementIndex],
          paint: {
            'fill-color': props.fillColor,
            'fill-opacity': 0.7,
          },
        });

        map.addLayer({
          id: strokeId,
          type: 'line',
          source: ELEMENTS_SOURCE,
          filter: ['==', ['get', 'elementIndex'], props.elementIndex],
          paint: {
            'line-color': props.strokeColor,
            'line-width': 1,
            'line-opacity': 0.5,
          },
        });

        newLayerIds.push(fillId, strokeId);
      });

      layerIdsRef.current = newLayerIds;
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once('styledata', render);
    }

    return () => {
      cleanupLayers(map, layerIdsRef.current);
      cleanupSource(map, HIGHLIGHT_SOURCE);
      cleanupSource(map, ELEMENTS_SOURCE);
      layerIdsRef.current = [];
    };
  }, [map, roadPath, beforeStreet, afterStreet, showBeforeOnMap, step, mode]);

  return null;
}

function cleanupLayers(map: maplibregl.Map, layerIds: string[]) {
  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  }
}

function cleanupSource(map: maplibregl.Map, sourceId: string) {
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}
