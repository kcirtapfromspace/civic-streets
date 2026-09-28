import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkDraftsStore, type StreetWork, type WorkDraft } from '@/stores/work-drafts-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useDrawingStore } from '@/stores/drawing-store';
import type { StreetProposal } from '@/lib/types';

function legacyWork(proposal: StreetProposal): StreetWork {
  return { kind: 'street', id: proposal.id, name: proposal.streetName, location: proposal.location, createdAt: proposal.metadata.createdAt, updatedAt: proposal.metadata.updatedAt, briefContext: proposal.briefContext ?? { concern: '', desiredOutcome: '', requestedNextStep: '', dimensionBasis: 'assumed', dimensionSource: '' }, step: 'review', roadPath: proposal.roadPath, bearing: proposal.bearing, beforePresetId: proposal.beforePresetId, beforeStreet: proposal.beforeStreet, afterStreet: proposal.afterStreet, selectedTemplateId: proposal.transformationTemplateId, showBeforeOnMap: false };
}

/** Browser-private work remains available across concern, concept and intersection journeys. */
export function SavedDrafts({ inline = false, onOpenWork }: { inline?: boolean; onOpenWork?: () => void }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const proposals = useSavedProposalsStore((state) => state.proposals);
  const proposalError = useSavedProposalsStore((state) => state.storageError);
  const work = useWorkDraftsStore((state) => state.drafts);
  const pending = useWorkDraftsStore((state) => state.pending);
  const workError = useWorkDraftsStore((state) => state.storageError);
  const activeTool = useDrawingStore((state) => state.activeTool);
  const storageError = workError || proposalError;
  const drafts = Object.values({ ...Object.fromEntries(Object.values(proposals).map((p) => [p.id, legacyWork(p)])), ...work, ...pending }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeDrafts = drafts.filter((draft) => !draft.archived);
  const load = () => { useSavedProposalsStore.getState().loadProposals(); useWorkDraftsStore.getState().load(); };
  useEffect(() => { useSavedProposalsStore.getState().loadProposals(); useWorkDraftsStore.getState().load(); }, []);
  const openDraft = (draft: WorkDraft) => {
    if (!useProposalStore.getState().saveWork() || !useIntersectionStore.getState().saveWork()) return;
    if (draft.kind === 'street') {
      useProposalStore.getState().loadWork(draft);
      if (draft.location) useWorkspaceStore.getState().enterProposeMode(draft.location);
      else useWorkspaceStore.setState({ mode: 'propose', designLocation: null });
    } else {
      useIntersectionStore.getState().loadWork(draft);
      if (draft.location) useWorkspaceStore.getState().enterIntersectionMode(draft.location);
      else useWorkspaceStore.setState({ mode: 'propose-intersection', designLocation: null });
    }
    setOpen(false);
    onOpenWork?.();
  };
  if (!inline && activeTool !== 'select') return null;
  return <>
    <button type="button" onClick={() => { load(); setOpen(true); }} className={inline ? 'min-h-11 px-3 text-sm font-medium text-[#172126] hover:bg-[#f3f5f5]' : 'absolute bottom-20 right-16 z-20 h-fit min-h-11 border border-[#d8dddf] bg-white px-3 py-2 text-xs font-semibold text-[#172126] shadow-sm sm:bottom-auto sm:right-4 sm:top-4'}>
      My work {storageError ? '— storage unavailable' : `(${activeDrafts.length})`}
    </button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title="My work">
      <div className="space-y-4 text-[#172126]">
        <p className="text-sm leading-relaxed text-[#59646a]">Private to this browser. Concerns and concepts save as you work and remain after reload. Clearing browser data removes them. Nothing here is published or submitted to a city.</p>
        {storageError && <div role="alert" className="border border-red-200 p-3 text-sm text-red-800"><p>{storageError}</p><button type="button" onClick={load} className="mt-2 min-h-11 underline">Retry loading drafts</button><button type="button" onClick={() => { useProposalStore.getState().saveWork(); useIntersectionStore.getState().saveWork(); useWorkDraftsStore.getState().retry(); }} className="ml-3 min-h-11 underline">Retry saving current work</button></div>}
        <form className="border border-[#d8dddf] p-3" onSubmit={(event) => {
          event.preventDefault();
          if (!place.trim() || !useProposalStore.getState().saveWork() || !useIntersectionStore.getState().saveWork()) return;
          useProposalStore.getState().initConcern(place.trim());
          useWorkspaceStore.setState({ mode: 'propose', designLocation: null });
          setOpen(false);
          setPlace('');
          onOpenWork?.();
        }}><label className="block text-sm font-medium">Describe the place<input className="mt-2 min-h-11 w-full border border-[#d8dddf] px-3 text-sm" value={place} maxLength={200} onChange={(event) => setPlace(event.target.value)} placeholder="For example, the north entrance to the library" /></label><button disabled={!place.trim()} className="mt-3 min-h-11 rounded-sm bg-[#172126] px-4 text-sm font-medium text-white disabled:bg-[#d8dddf] disabled:text-[#59646a]">New private concern</button><p className="mt-2 text-xs text-[#59646a]">Start with words. A map, public post or street layout is optional.</p></form>
        {!storageError && activeDrafts.length === 0 && <p className="text-sm">No active work yet. Choose a place on the map to start a private concern or an intersection concept.</p>}
        {drafts.some((draft) => draft.archived) && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Show archived work</label>}
        <ul className="divide-y divide-[#d8dddf] border-y border-[#d8dddf]">
          {drafts.filter((draft) => showArchived || !draft.archived).map((draft) => <li key={draft.id} className="py-3">
            <button type="button" className="min-h-11 w-full py-2 text-left hover:bg-[#f3f5f5] focus-visible:outline-2 focus-visible:outline-[#172126]" onClick={() => openDraft(draft)}>
              <span className="block text-sm font-semibold">Reopen {draft.name || (draft.kind === 'intersection' ? 'Intersection concept' : 'Street proposal')}</span>
              <span className="mt-1 block text-xs text-[#59646a]">{draft.location?.address || 'Location described in title'} · {draft.kind === 'intersection' ? 'Intersection' : draft.afterStreet ? 'Street concept' : 'Concern'} · {draft.archived ? 'Archived' : `Saved ${new Date(draft.updatedAt).toLocaleDateString()}`}</span>
            </button>
            <details className="mt-1 text-sm"><summary className="min-h-11 cursor-pointer content-center">Follow-up notes</summary>
              <label className="block text-xs leading-relaxed text-[#59646a]">Record who you contacted, any response and your next step. These are your private notes, not verified city status.
                <textarea aria-label={`Follow-up for ${draft.name || 'untitled work'}`} maxLength={3000} rows={3} className="mt-2 w-full border border-[#d8dddf] p-2 text-sm text-[#172126]" defaultValue={draft.followUp ?? ''} onChange={(event) => useWorkDraftsStore.getState().save({ ...draft, followUp: event.target.value, updatedAt: new Date().toISOString() })} />
              </label>
            </details>
            <button type="button" className="min-h-11 text-xs underline" onClick={() => useWorkDraftsStore.getState().save({ ...draft, archived: !draft.archived, updatedAt: new Date().toISOString() })}>{draft.archived ? 'Restore work' : 'Archive work'}</button>
          </li>)}
        </ul>
        <p className="text-xs text-[#59646a]">Archive hides work from this list. You can restore it from Show archived work.</p>
      </div>
    </Modal>
  </>;
}
