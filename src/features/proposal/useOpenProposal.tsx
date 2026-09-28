import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui';
import type { StreetProposal } from '@/lib/types';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

/** Both the map and saved list must protect current unsaved work before switching. */
export function useOpenProposal() {
  const [pending, setPending] = useState<StreetProposal | null>(null);
  const currentName = useProposalStore((state) => state.streetName);
  const openProposal = useCallback((proposal: StreetProposal) => {
    if (useProposalStore.getState().tryLoadProposal(proposal)) {
      useWorkspaceStore.getState().enterProposeMode(proposal.location);
    } else {
      setPending(proposal);
    }
  }, []);

  const confirmation = pending && (
    <Modal isOpen onClose={() => setPending(null)} title="Replace unsaved work?">
      <p className="text-sm leading-relaxed text-[#59646a]">
        Opening {pending.streetName || 'this saved draft'} will discard unsaved changes to {currentName || 'your current proposal'}. Any previously saved copy will remain available.
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setPending(null)} className="min-h-11 rounded-sm border border-[#d8dddf] bg-white px-4 text-sm font-medium text-[#172126]">
          Keep current work
        </button>
        <button type="button" onClick={() => {
          useProposalStore.getState().loadProposal(pending);
          useWorkspaceStore.getState().enterProposeMode(pending.location);
          setPending(null);
        }} className="min-h-11 rounded-sm bg-[#172126] px-4 text-sm font-medium text-white">
          Discard changes and open draft
        </button>
      </div>
    </Modal>
  );
  return { openProposal, confirmation };
}
