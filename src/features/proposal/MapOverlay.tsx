import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useProposalStore } from '@/stores/proposal-store';
import { useStreetStore } from '@/stores/street-store';
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
  const designProposalId = useWorkspaceStore((s) => s.designProposalId);
  const proposalId = useProposalStore((s) => s.proposalId);
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const editorBeforeStreet = useStreetStore((s) => s.beforeStreet);
  const showBeforeAfter = useStreetStore((s) => s.showBeforeAfter);
  const roadPath = useProposalStore((s) => s.roadPath);
  const beforeStreet = useProposalStore((s) => s.beforeStreet);
  const afterStreet = useProposalStore((s) => s.afterStreet);
  const showBeforeOnMap = useProposalStore((s) => s.showBeforeOnMap);
  const step = useProposalStore((s) => s.step);
  const styleVersion = useStyleReload(map);

  const resultRef = useRef<RenderStreetResult | null>(null);
  const linkedEditing = mode === 'design' && !!designProposalId && designProposalId === proposalId;
  const street = linkedEditing
    ? showBeforeAfter && editorBeforeStreet
      ? editorBeforeStreet
      : currentStreet
    : step === 'review' || step === 'transform-selected'
      ? showBeforeOnMap
        ? beforeStreet
        : afterStreet
      : beforeStreet;

  // Draw road highlight + element polygons
  useEffect(() => {
    if (!map) return;
    const cleanup = () => {
      if (!resultRef.current) return;
      cleanupMapLayers(map, resultRef.current.layerIds);
      for (const sid of resultRef.current.sourceIds) cleanupMapSource(map, sid);
      resultRef.current = null;
    };

    cleanup();

    if (roadPath.length < 2 || (mode !== 'propose' && !linkedEditing)) return;

    const render = () => {
      if (!map.isStyleLoaded()) return;

      if (!street) return;

      // Track the IDs before drawing, so a style error halfway through a render
      // cannot leave a source behind that blocks the next attempt.
      resultRef.current = {
        sourceIds: [`${ACTIVE_PREFIX}-highlight`, `${ACTIVE_PREFIX}-elements`],
        layerIds: [
          `${ACTIVE_PREFIX}-highlight-line`,
          ...street.elements.flatMap((_, index) => [
            `${ACTIVE_PREFIX}-element-fill-${index}`,
            `${ACTIVE_PREFIX}-element-stroke-${index}`,
          ]),
        ],
      };
      try {
        resultRef.current = renderStreetOnMap(map, ACTIVE_PREFIX, roadPath, street);
      } catch {
        cleanup();
      }
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once('styledata', render);
    }

    return () => {
      map.off('styledata', render);
      cleanup();
    };
  }, [map, roadPath, street, linkedEditing, mode, styleVersion]);

  return null;
}
