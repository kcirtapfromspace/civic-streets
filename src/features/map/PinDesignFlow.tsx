import { useEffect, useCallback, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { useMapStore, type MapState } from './map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useDrawingStore } from '@/stores/drawing-store';
import { reverseGeocodeLocation } from '@/lib/api/geocoding';
import { fetchRoadPath } from '@/features/proposal/utils/road-geometry';
import { useStartProposal } from '@/features/proposal/useStartProposal';

interface PinDesignFlowProps {
  map: maplibregl.Map | null;
}

/** Offers problem capture and optional sketches at the location a resident clicks. */
export function PinDesignFlow({ map }: PinDesignFlowProps) {
  const openContextMenu = useMapStore((s) => s.openContextMenu);
  const closeContextMenu = useMapStore((s) => s.closeContextMenu);
  const contextMenuPosition = useMapStore((s) => s.contextMenuPosition);
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation);
  const openReportForm = useMapStore((s) => s.openReportForm);
  const [pendingContext, setPendingContext] = useState<MapState['contextMenuPosition']>(null);
  const pendingRequest = useRef<MapState['contextMenuPosition']>(null);
  const isMounted = useRef(false);
  const isPending = contextMenuPosition !== null && pendingContext === contextMenuPosition;
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const { startProposal, confirmation } = useStartProposal();

  useEffect(() => {
    if (!map) return;
    const onClick = (event: maplibregl.MapMouseEvent) => {
      if (useWorkspaceStore.getState().mode === 'place-street') return;
      if (useDrawingStore.getState().activeTool !== 'select') return;
      if (useMapStore.getState().lockedToLocation) return;
      const { lat, lng } = event.lngLat;
      const point = map.project(event.lngLat);
      const rect = map.getContainer().getBoundingClientRect();
      openContextMenu({ lat, lng, x: point.x + rect.left, y: point.y + rect.top });
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, openContextMenu]);

  useEffect(() => {
    if (!map) return;
    const close = () => closeContextMenu();
    map.on('dragstart', close);
    map.on('zoom', close);
    return () => {
      map.off('dragstart', close);
      map.off('zoom', close);
    };
  }, [map, closeContextMenu]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    firstActionRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && contextMenuPosition) {
        closeContextMenu();
        map?.getCanvas().focus();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuPosition, closeContextMenu, map]);

  const handleAction = useCallback(
    async (action: 'proposal' | 'report') => {
      if (!contextMenuPosition || pendingRequest.current === contextMenuPosition) return;
      pendingRequest.current = contextMenuPosition;
      setPendingContext(contextMenuPosition);
      const { lat, lng } = contextMenuPosition;
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      let streetName = 'Selected street';
      try {
        const result = await reverseGeocodeLocation(lat, lng);
        if (result?.display_name) {
          address = result.display_name;
          streetName = address.split(',')[0].trim();
        }
      } catch {
        /* Coordinates remain usable when address lookup is unavailable. */
      }
      if (!isMounted.current || useMapStore.getState().contextMenuPosition !== contextMenuPosition)
        return;
      const location = { lat, lng, address };
      setSelectedLocation(location);
      closeContextMenu();
      if (action === 'report') {
        openReportForm(location);
        return;
      }
      startProposal({ streetName, location, onStarted: async () => {
        const { proposalId, setRoadPath } = useProposalStore.getState();
        try {
          const { path, bearing } = await fetchRoadPath({ lat, lng });
          if (
            useProposalStore.getState().proposalId === proposalId &&
            useWorkspaceStore.getState().mode === 'propose'
          ) {
            setRoadPath(path, bearing);
          }
        } catch {
          /* A proposal can begin without road geometry. */
        }
      } });
    },
    [contextMenuPosition, setSelectedLocation, closeContextMenu, openReportForm, startProposal],
  );

  if (!contextMenuPosition) return confirmation;

  return (
    <section
      role="dialog"
      aria-label="Choose an action at this location"
      aria-busy={isPending}
      className="fixed z-50 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-lg border border-[#d8dddf] bg-white p-2 text-[#172126]"
      style={{
        width: 'min(280px, calc(100vw - 24px))',
        left: `clamp(12px, ${contextMenuPosition.x}px, max(12px, calc(100vw - 292px)))`,
        top: `clamp(12px, ${contextMenuPosition.y}px, max(12px, calc(100dvh - 240px)))`,
      }}
    >
      <div className="flex items-center justify-between gap-2 pl-2">
        <p className="text-[10px] font-semibold  text-[#59646a]">At this location</p>
        <button
          type="button"
          aria-label="Close location actions"
          onClick={closeContextMenu}
          className="min-h-11 min-w-11 rounded-md text-lg hover:bg-[#f3f5f5] focus-visible:outline-2 focus-visible:outline-[#172126]"
        >
          ×
        </button>
      </div>
      <button
        ref={firstActionRef}
        type="button"
        disabled={isPending}
        onClick={() => void handleAction('report')}
        className="min-h-16 w-full rounded-md bg-[#172126] px-3 py-3 text-left text-white hover:bg-[#303d43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172126] disabled:opacity-60"
      >
        <span className="block text-sm font-semibold">Mark a problem</span>
        <span className="mt-1 block text-xs text-white/80">Add details about this location</span>
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => void handleAction('proposal')}
        className="mt-1 min-h-16 w-full rounded-md px-3 py-3 text-left hover:bg-[#f3f5f5] focus-visible:outline-2 focus-visible:outline-[#172126] disabled:opacity-60"
      >
        <span className="block text-sm font-semibold">Sketch a change</span>
        <span className="mt-1 block text-xs text-[#59646a]">
          Explore a possible street improvement
        </span>
      </button>
      {isPending && (
        <p role="status" className="px-3 py-2 text-xs text-[#59646a]">
          Finding the address…
        </p>
      )}
    </section>
  );
}
