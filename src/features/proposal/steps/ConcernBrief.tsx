import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useProposalStore } from '@/stores/proposal-store';
import { BriefPreview } from '@/features/export/BriefPreview';
import { PrivateBriefDownload } from '../PrivateBriefDownload';
import { ConcernFields } from './ConcernStep';

export function ConcernBrief() {
  const context = useProposalStore((s) => s.briefContext);
  const id = useProposalStore((s) => s.proposalId);
  const draft = useWorkDraftsStore((s) => id ? s.pending[id] ?? s.drafts[id] : undefined);
  const exportContext = { ...context, briefId: id ?? undefined, revisedAt: draft?.updatedAt };
  const location = useProposalStore((s) => s.location);
  const name = useProposalStore((s) => s.streetName);
  const setContext = useProposalStore((s) => s.setBriefContext);
  return <div className="space-y-4">
    <h3 className="text-base font-semibold">Prepare your discussion brief</h3>
    <ConcernFields />
    <label className="block text-sm font-medium">What next step are you asking for?
      <textarea className="mt-1 w-full rounded-sm border border-[#d8dddf] p-3" rows={3} maxLength={2000} placeholder="For example, ask for a site visit or a response from the street maintenance team." value={context.requestedNextStep} onChange={(event) => setContext({ requestedNextStep: event.target.value })} />
    </label>
    <details><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Read the brief</summary><BriefPreview context={exportContext} title={name || 'Discussion brief'} location={location ?? undefined} /></details>
    <p className="text-xs leading-relaxed text-[#59646a]">This is your account of the concern and request. It is not an engineering assessment, city submission or confirmation that action will be taken.</p>
    <PrivateBriefDownload context={exportContext} name={name} location={location} />
    <button disabled={!location} onClick={() => useProposalStore.getState().continueToExplore()} className="min-h-11 w-full border border-[#d8dddf] text-sm font-medium">Explore a street layout</button>
  </div>;
}
