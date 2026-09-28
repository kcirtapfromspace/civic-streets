import { useEffect, useMemo, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { useWorkDraftsStore, type StreetWork } from '@/stores/work-drafts-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import type { StreetLocation, StreetProposal, StreetSegment } from '@/lib/types';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStyleReload } from '@/features/map/useStyleReload';
import { useMapStore } from '@/features/map/map-store';
import { useOpenProposal } from './useOpenProposal';
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
type PlacedWork = StreetWork & { location: StreetLocation; afterStreet: StreetSegment };

/**
 * Renders all saved proposals on the map as semi-transparent polygon overlays.
 * Clicking a saved proposal in explore mode reopens it in the proposal wizard.
 */
export function SavedProposalsLayer({ map }: SavedProposalsLayerProps) {
  const proposals = useSavedProposalsStore((s) => s.proposals);
  const workDrafts = useWorkDraftsStore((s) => s.drafts);
  const [openError, setOpenError] = useState(false);
  const saved = useMemo(() => {
    const entries = new Map<string, StreetProposal | PlacedWork>(Object.entries(proposals));
    for (const [id, work] of Object.entries(workDrafts)) {
      // Newer work owns the identity, even when archived or no longer placed.
      entries.delete(id);
      if (
        work.kind === 'street' &&
        !work.archived &&
        work.location &&
        work.afterStreet &&
        work.roadPath.length >= 2
      )
        entries.set(id, { ...work, location: work.location, afterStreet: work.afterStreet });
    }
    return entries;
  }, [proposals, workDrafts]);
  const { openProposal, confirmation } = useOpenProposal();
  const activeId = useProposalStore((s) => s.proposalId);
  const mode = useWorkspaceStore((s) => s.mode);
  const designProposalId = useWorkspaceStore((s) => s.designProposalId);
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

      for (const [id, proposal] of saved) {
        if (
          (mode === 'propose' ||
            mode === 'place-street' ||
            (mode === 'design' && designProposalId === activeId)) &&
          id === activeId
        )
          continue;
        const prefix = `${SAVED_PREFIX}${id}`;
        renderedRef.current.set(id, {
          sourceIds: [`${prefix}-highlight`, `${prefix}-elements`],
          layerIds: [
            `${prefix}-highlight-line`,
            ...proposal.afterStreet.elements.flatMap((_, index) => [
              `${prefix}-element-fill-${index}`,
              `${prefix}-element-stroke-${index}`,
            ]),
          ],
        });
        try {
          const result = renderStreetOnMap(map, prefix, proposal.roadPath, proposal.afterStreet, {
            opacity: 0.78,
          });
          renderedRef.current.set(id, result);
        } catch {
          const partial = renderedRef.current.get(id)!;
          cleanupMapLayers(map, partial.layerIds);
          for (const source of partial.sourceIds) cleanupMapSource(map, source);
          renderedRef.current.delete(id);
        }
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
  }, [map, saved, styleVersion, mode, activeId, designProposalId]);

  // Click to reopen in explore mode
  useEffect(() => {
    if (!map || mode !== 'explore') return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point);
      const savedFeature = features.find(
        (f) => f.layer.id.startsWith(SAVED_PREFIX) && f.layer.id.includes('-element-fill-'),
      );

      if (!savedFeature) return;
      useMapStore.getState().closeContextMenu();

      // Extract proposal ID from layer ID: "saved-{id}-element-fill-{n}"
      const layerId = savedFeature.layer.id;
      const proposalId = layerId
        .replace(SAVED_PREFIX, '')
        .replace(/-element-fill-\d+$/, '')
        .replace(/-element-stroke-\d+$/, '')
        .replace(/-highlight-line$/, '');

      const proposal = saved.get(proposalId);
      if (!proposal) return;
      if ('kind' in proposal) {
        if (
          !useProposalStore.getState().saveWork() ||
          !useIntersectionStore.getState().saveWork()
        ) {
          setOpenError(true);
          return;
        }
        setOpenError(false);
        useProposalStore
          .getState()
          .loadWork({
            ...proposal,
            step: proposal.beforeStreet ? 'review' : 'concern',
            showBeforeOnMap: false,
          });
        useWorkspaceStore.getState().enterProposeMode(proposal.location);
      } else {
        openProposal(proposal);
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, mode, openProposal, saved]);

  // Hover cursor in explore mode
  useEffect(() => {
    if (!map || mode !== 'explore') return;

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point);
      const overSaved = features.some(
        (f) => f.layer.id.startsWith(SAVED_PREFIX) && f.layer.id.includes('-element-fill-'),
      );
      map.getCanvas().style.cursor = overSaved ? 'pointer' : '';
    };

    map.on('mousemove', onMouseMove);
    return () => {
      map.off('mousemove', onMouseMove);
      map.getCanvas().style.cursor = '';
    };
  }, [map, mode]);

  return (
    <>
      {confirmation}
      {openError && (
        <div
          role="alert"
          className="absolute left-4 top-4 z-30 max-w-sm border border-red-200 bg-white p-3 text-sm text-red-800"
        >
          <p>
            Your current work could not be saved. Open My work to retry before switching concepts.
          </p>
          <button
            type="button"
            onClick={() => setOpenError(false)}
            className="mt-2 min-h-11 underline"
          >
            Keep current work
          </button>
        </div>
      )}
    </>
  );
}
