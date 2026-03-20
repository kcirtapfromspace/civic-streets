import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStyleReload } from '@/features/map/useStyleReload';
import {
  renderStreetOnMap,
  cleanupMapLayers,
  cleanupMapSource,
  type RenderStreetResult,
} from './utils/render-street-layers';

interface SavedProposalsLayerProps {
  map: maplibregl.Map | null;
}

const SAVED_PREFIX = 'saved-';

/**
 * Renders all saved proposals on the map as semi-transparent polygon overlays.
 * Clicking a saved proposal in explore mode reopens it in the proposal wizard.
 */
export function SavedProposalsLayer({ map }: SavedProposalsLayerProps) {
  const proposals = useSavedProposalsStore((s) => s.proposals);
  const removeProposal = useSavedProposalsStore((s) => s.removeProposal);
  const mode = useWorkspaceStore((s) => s.mode);
  const styleVersion = useStyleReload(map);

  const renderedRef = useRef<Map<string, RenderStreetResult>>(new Map());

  // Render/update saved proposal layers
  useEffect(() => {
    if (!map) return;

    const cleanup = () => {
      for (const [, result] of renderedRef.current) {
        cleanupMapLayers(map, result.layerIds);
        for (const sid of result.sourceIds) cleanupMapSource(map, sid);
      }
      renderedRef.current.clear();
    };

    cleanup();

    const render = () => {
      if (!map.isStyleLoaded()) return;

      for (const [id, proposal] of Object.entries(proposals)) {
        const prefix = `${SAVED_PREFIX}${id}`;
        try {
          const result = renderStreetOnMap(
            map,
            prefix,
            proposal.roadPath,
            proposal.afterStreet,
            { opacity: 0.5 },
          );
          renderedRef.current.set(id, result);
        } catch {
          // Style may have changed mid-render
        }
      }
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once('styledata', render);
    }

    return cleanup;
  }, [map, proposals, styleVersion]);

  // Click to reopen in explore mode
  useEffect(() => {
    if (!map || mode !== 'explore') return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point);
      const savedFeature = features.find((f) =>
        f.layer.id.startsWith(SAVED_PREFIX) && f.layer.id.includes('-element-fill-'),
      );

      if (!savedFeature) return;

      // Extract proposal ID from layer ID: "saved-{id}-element-fill-{n}"
      const layerId = savedFeature.layer.id;
      const proposalId = layerId
        .replace(SAVED_PREFIX, '')
        .replace(/-element-fill-\d+$/, '')
        .replace(/-element-stroke-\d+$/, '')
        .replace(/-highlight-line$/, '');

      const proposal = useSavedProposalsStore.getState().getProposal(proposalId);
      if (!proposal) return;

      // Remove from saved (avoid visual duplication with active proposal)
      removeProposal(proposalId);

      // Load into proposal store and enter propose mode
      const { loadProposal } = useProposalStore.getState();
      const { enterProposeMode } = useWorkspaceStore.getState();

      loadProposal(proposal);
      enterProposeMode(proposal.location);
    };

    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, mode, removeProposal]);

  // Hover cursor in explore mode
  useEffect(() => {
    if (!map || mode !== 'explore') return;

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point);
      const overSaved = features.some((f) =>
        f.layer.id.startsWith(SAVED_PREFIX) && f.layer.id.includes('-element-fill-'),
      );
      map.getCanvas().style.cursor = overSaved ? 'pointer' : '';
    };

    map.on('mousemove', onMouseMove);
    return () => {
      map.off('mousemove', onMouseMove);
      map.getCanvas().style.cursor = '';
    };
  }, [map, mode]);

  return null;
}
