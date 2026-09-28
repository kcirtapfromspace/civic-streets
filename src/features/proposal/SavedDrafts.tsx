import { useState } from 'react';
import { Modal } from '@/components/ui';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useDrawingStore } from '@/stores/drawing-store';
import { useOpenProposal } from './useOpenProposal';

export function SavedDrafts() {
  const [open, setOpen] = useState(false);
  const { openProposal, confirmation } = useOpenProposal();
  const proposals = useSavedProposalsStore((state) => state.proposals);
  const storageError = useSavedProposalsStore((state) => state.storageError);
  const loadProposals = useSavedProposalsStore((state) => state.loadProposals);
  const currentLocation = useProposalStore((state) => state.location);
  const currentName = useProposalStore((state) => state.streetName);
  const activeTool = useDrawingStore((state) => state.activeTool);
  const drafts = Object.values(proposals).sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));

  if (activeTool !== 'select') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { loadProposals(); setOpen(true); }}
        className="absolute bottom-20 right-16 z-20 h-fit min-h-11 border border-[#d8dddf] bg-[#ffffff] px-3 py-2 text-xs font-semibold text-[#172126] shadow-sm sm:bottom-auto sm:right-4 sm:top-4"
      >
        Saved drafts {storageError ? '— storage unavailable' : `(${drafts.length})`}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Saved drafts">
        <div className="space-y-4 text-[#172126]">
          <p className="text-sm leading-relaxed text-[#59646a]">Private to this browser. Drafts remain after reload, but clearing browser data removes them. Nothing here is published or submitted to a city.</p>
          {storageError && (
            <div role="alert" className="border border-red-200 p-3 text-sm text-red-800">
              <p>{storageError}</p>
              <button type="button" onClick={loadProposals} className="mt-2 underline">Retry loading drafts</button>
            </div>
          )}
          {currentLocation && (
            <div className="border border-[#d8dddf] bg-[#ffffff] p-4">
              <p className="text-xs text-[#59646a]">Unfinished work stays here until you reload or start another street.</p>
              <button type="button" className="mt-2 text-sm font-semibold underline" onClick={() => {
                setOpen(false);
                useWorkspaceStore.getState().enterProposeMode(currentLocation);
              }}>Resume {currentName || 'current proposal'}</button>
            </div>
          )}
          {!storageError && drafts.length === 0 && <p className="text-sm">No saved drafts yet. Choose a street, compare an improvement, then select Save draft.</p>}
          <ul className="divide-y divide-[#d8dddf] border-y border-[#d8dddf]">
            {drafts.map((proposal) => (
              <li key={proposal.id}>
                <button type="button" className="w-full py-4 text-left hover:bg-[#f3f5f5] focus-visible:outline-2 focus-visible:outline-[#172126]" onClick={() => {
                  setOpen(false);
                  openProposal(proposal);
                }}>
                  <span className="block text-sm font-semibold">Reopen {proposal.streetName || 'Street proposal'}</span>
                  <span className="mt-1 block text-xs text-[#59646a]">{proposal.location.address} · Saved {new Date(proposal.metadata.updatedAt).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
      {confirmation}
    </>
  );
}
