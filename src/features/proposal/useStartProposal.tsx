import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui';
import type { ObservationSnapshot, StreetLocation } from '@/lib/types';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useMapStore } from '@/features/map/map-store';

interface StartProposalRequest {
  streetName: string;
  location: StreetLocation;
  observation?: ObservationSnapshot;
  onStarted?: () => void;
}

/** Every entry point must offer an explicit choice before replacing unsaved work. */
export function useStartProposal() {
  const [pending, setPending] = useState<StartProposalRequest | null>(null);
  const currentName = useProposalStore((state) => state.streetName);
  const begin = useCallback((request: StartProposalRequest) => {
    useProposalStore.getState().initProposal(request.streetName, request.location, request.observation);
    useMapStore.getState().setCenter({ lat: request.location.lat, lng: request.location.lng });
    useMapStore.getState().setZoom(18);
    useWorkspaceStore.getState().enterProposeMode(request.location);
    request.onStarted?.();
  }, []);
  const startProposal = useCallback((request: StartProposalRequest) => {
    if (useProposalStore.getState().hasUnsavedChanges()) setPending(request);
    else begin(request);
  }, [begin]);

  const confirmation = pending && (
    <Modal isOpen onClose={() => setPending(null)} title="Replace unsaved work?">
      <p className="text-sm leading-relaxed text-[#59646a]">
        Starting a new proposal will discard unsaved changes to {currentName || 'your current proposal'}. Any saved copy will remain available.
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setPending(null)} className="min-h-11 rounded-sm border border-[#d8dddf] bg-white px-4 text-sm font-medium text-[#172126]">
          Keep current work
        </button>
        <button type="button" onClick={() => { begin(pending); setPending(null); }} className="min-h-11 rounded-sm bg-[#172126] px-4 text-sm font-medium text-white">
          Discard changes and start proposal
        </button>
      </div>
    </Modal>
  );
  return { startProposal, confirmation };
}
