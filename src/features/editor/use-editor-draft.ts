import { useEffect } from 'react';
import { useStreetStore } from '@/stores/street-store';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useWorkDraftsStore, type StreetWork } from '@/stores/work-drafts-store';

/** Preserve an editor concept under one work identity, including template replacements. */
export function editorWorkSnapshot(): StreetWork | null {
  const { currentStreet, beforeStreet, workId } = useStreetStore.getState();
  if (!currentStreet) return null;
  const proposal = useProposalStore.getState();
  const linkedId = useWorkspaceStore.getState().designProposalId;
  const isLinked =
    (linkedId && linkedId === proposal.proposalId) || proposal.afterStreet?.id === currentStreet.id;
  const linked = isLinked ? proposal.getWork() : null;
  const id = linked?.id ?? workId ?? currentStreet.id;
  const storage = useWorkDraftsStore.getState();
  const saved = storage.pending[id] ?? storage.drafts[id];
  const previous = linked ?? (saved?.kind === 'street' ? saved : null);
  const location = previous?.location ?? currentStreet.location ?? null;
  return {
    kind: 'street',
    id,
    name: currentStreet.name,
    location,
    createdAt: previous?.createdAt ?? currentStreet.metadata.createdAt,
    updatedAt: currentStreet.metadata.updatedAt,
    briefContext: previous?.briefContext ?? {
      concern: '',
      desiredOutcome: '',
      requestedNextStep: '',
      dimensionBasis: 'assumed',
      dimensionSource: '',
    },
    step: 'review',
    roadPath: previous?.roadPath ?? [],
    bearing: previous?.bearing ?? 0,
    beforePresetId: previous?.beforePresetId ?? null,
    selectedTemplateId: previous?.selectedTemplateId ?? currentStreet.metadata.templateId ?? null,
    beforeStreet: beforeStreet ?? previous?.beforeStreet ?? currentStreet,
    afterStreet:
      location && !currentStreet.location ? { ...currentStreet, location } : currentStreet,
    showBeforeOnMap: false,
  };
}

export function saveEditorWork(): StreetWork | null {
  const work = editorWorkSnapshot();
  if (!work) return null;
  if (work.id === useProposalStore.getState().proposalId) {
    // Keep the linked editor and proposal consistent so a later save cannot
    // replace this geometry with the older version from the proposal wizard.
    useProposalStore.setState({
      afterStreet: work.afterStreet,
      beforeStreet: work.beforeStreet,
      streetName: work.name,
      location: work.location,
      step: 'review',
      selectedTemplateId: work.selectedTemplateId,
    });
    return useWorkDraftsStore.getState().pending[work.id] ? null : work;
  }
  return useWorkDraftsStore.getState().save(work) ? work : null;
}

export function useEditorDraft() {
  const street = useStreetStore((state) => state.currentStreet);
  const before = useStreetStore((state) => state.beforeStreet);
  const workId = useStreetStore((state) => state.workId);
  const linkedId = useWorkspaceStore((state) => state.designProposalId);
  const proposalId = useProposalStore((state) => state.proposalId);
  const purpose = useProposalStore((state) => state.briefContext);
  useEffect(() => {
    saveEditorWork();
  }, [street, before, workId, linkedId, proposalId, purpose]);
  return useWorkDraftsStore((state) => state.storageError);
}
