import { IMPROVEMENT_BY_ID } from '@/lib/presets/intersection-improvements';
import { useIntersectionStore } from '@/stores/intersection-store';

/** Semantic, printable review of the resident's request; no claim of city receipt. */
export function IntersectionBrief() {
  const state = useIntersectionStore();
  return <article aria-label="Intersection discussion brief" className="space-y-4 rounded-sm border border-[#d8dddf] bg-white p-4 text-[#172126]">
    <header><h4 className="text-lg font-semibold">{state.intersectionName || 'Intersection discussion brief'}</h4><p className="mt-1 text-xs text-[#59646a]">{state.location?.address} · Private discussion draft</p></header>
    <dl className="space-y-3 text-sm">
      {([['Concern', state.briefContext.concern], ['Desired outcome', state.briefContext.desiredOutcome], ['Requested next step', state.briefContext.requestedNextStep]] as const).map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap">{value || 'Add this before sharing.'}</dd></div>)}
      <div><dt className="font-semibold">Existing conditions</dt><dd className="mt-1">{state.conditions ? `${state.conditions.trafficControl.replace(/-/g, ' ')}; ${state.conditions.crossingType.replace(/-/g, ' ')}` : 'Conditions have not been selected.'} Conditions are a resident-selected approximation and need to be checked on site.</dd></div>
    </dl>
    <section><h5 className="text-sm font-semibold">Ideas to discuss</h5><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{state.selectedImprovements.map((id) => IMPROVEMENT_BY_ID.get(id)).filter((item) => !!item).map((item) => <li key={item.id}><span className="font-medium">{item.label}</span> — {item.description}</li>)}</ul></section>
    <p className="text-xs leading-relaxed text-[#59646a]">This is a discussion concept, not a verified engineering plan or a city submission. Feasibility, accessibility, cost and safety effects require local review. Crash data suggestions are exploratory and do not establish cause or predict an outcome.</p>
    <p className="text-xs text-[#59646a]">Draft reference: {state.proposalId || 'Not yet saved'}</p>
  </article>;
}
