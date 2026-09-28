import { useProposalStore } from '@/stores/proposal-store';

const FIELD_CLASS = 'mt-1 w-full rounded-sm border border-[#d8dddf] bg-white px-3 py-2 text-sm leading-relaxed text-[#172126] focus:border-[#172126] focus:outline-none';

/** Editable purpose stays available throughout the concept flow. */
export function ConcernFields() {
  const context = useProposalStore((s) => s.briefContext);
  const location = useProposalStore((s) => s.location);
  const setContext = useProposalStore((s) => s.setBriefContext);
  const observation = context.observation;

  return (
    <div className="flex flex-col gap-3">
      {location && <p className="text-xs leading-relaxed text-[#59646a]">{location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</p>}
      {observation && (
        <div className="border-l-2 border-[#d8dddf] pl-3 text-xs text-[#59646a]">
          <p className="font-medium text-[#172126]">From observation: {observation.title}</p>
          <p className="mt-1">{observation.source === 'example' ? 'Example observation' : observation.source === 'browser-session' ? 'Saved for this browser session' : 'Community observation'} · Evidence captured when this draft started.</p>
          {observation.description && <p className="mt-2 leading-relaxed whitespace-pre-wrap">{observation.description}</p>}
          {observation.photoUrls.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {observation.photoUrls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" aria-label={`Open observation photo ${index + 1}`} className="shrink-0"><img src={url} alt={`Observation photo ${index + 1}`} className="h-20 w-28 rounded-sm object-cover" /></a>)}
            </div>
          )}
        </div>
      )}
      <label className="text-xs font-medium text-[#172126]">
        What is happening here?
        <textarea value={context.concern} onChange={(event) => setContext({ concern: event.target.value })} rows={2} maxLength={3000} placeholder="Describe the problem and who it affects." className={FIELD_CLASS} />
      </label>
      <label className="text-xs font-medium text-[#172126]">
        What would you like to improve?
        <textarea value={context.desiredOutcome} onChange={(event) => setContext({ desiredOutcome: event.target.value })} rows={2} maxLength={2000} placeholder="For example, make room for people to pass on the sidewalk." className={FIELD_CLASS} />
      </label>
    </div>
  );
}

export function ConcernStep() {
  const continueToExplore = useProposalStore((s) => s.continueToExplore);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold tracking-tight text-[#172126]">Start with the concern</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#59646a]">Give the concept a purpose. You can update these notes as you explore.</p>
      </div>
      <ConcernFields />
      <button onClick={continueToExplore} className="min-h-11 rounded-sm bg-[#172126] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d383e]">Continue to explore</button>
    </div>
  );
}
