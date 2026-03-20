import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStyleReload } from '@/features/map/useStyleReload';
import {
  renderStreetOnMap,
  cleanupMapLayers,
  cleanupMapSource,
  type RenderStreetResult,
} from './utils/render-street-layers';

interface MapOverlayProps {
  map: maplibregl.Map | null;
}

const ACTIVE_PREFIX = 'proposal-active';

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
  const styleVersion = useStyleReload(map);

  const resultRef = useRef<RenderStreetResult | null>(null);

  // Cleanup helper
  const cleanup = () => {
    if (!map || !resultRef.current) return;
    cleanupMapLayers(map, resultRef.current.layerIds);
    for (const sid of resultRef.current.sourceIds) cleanupMapSource(map, sid);
    resultRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [map]);

  // Draw road highlight + element polygons
  useEffect(() => {
    if (!map) return;

    cleanup();

    if (roadPath.length < 2 || mode !== 'propose') return;

    const render = () => {
      if (!map.isStyleLoaded()) return;

      const street = (step === 'review' || step === 'transform-selected')
        ? (showBeforeOnMap ? beforeStreet : afterStreet)
        : beforeStreet;

      if (!street) return;

      try {
        resultRef.current = renderStreetOnMap(map, ACTIVE_PREFIX, roadPath, street);
      } catch {
        // Style may have changed mid-render
      }
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once('styledata', render);
    }

    return cleanup;
  }, [map, roadPath, beforeStreet, afterStreet, showBeforeOnMap, step, mode, styleVersion]);

  return null;
}
