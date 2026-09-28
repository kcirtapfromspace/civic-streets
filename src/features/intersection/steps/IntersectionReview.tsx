import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { IMPROVEMENT_BY_ID, CATEGORY_LABELS, COMPLEXITY_LABELS } from '@/lib/presets/intersection-improvements';
import { PrivateBriefDownload } from '@/features/proposal/PrivateBriefDownload';
import { IntersectionBrief } from '../IntersectionBrief';
import { captureAnalytics } from '@/lib/analytics';

export function IntersectionReview() {
  const intersectionName = useIntersectionStore((s) => s.intersectionName);
  const conditions = useIntersectionStore((s) => s.conditions);
  const selectedImprovements = useIntersectionStore((s) => s.selectedImprovements);
  const crashSummary = useIntersectionStore((s) => s.crashSummary);
  const briefContext = useIntersectionStore((s) => s.briefContext);
  const proposalId = useIntersectionStore((s) => s.proposalId);
  const draft = useWorkDraftsStore((s) => proposalId ? s.pending[proposalId] ?? s.drafts[proposalId] : undefined);
  const createdAt = useIntersectionStore((s) => s.createdAt);
  const location = useIntersectionStore((s) => s.location);
  const goBack = useIntersectionStore((s) => s.goBack);
  const reset = useIntersectionStore((s) => s.reset);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);

  if (!conditions) return null;

  const handleDone = () => {
    if (!useIntersectionStore.getState().saveWork()) return;
    captureAnalytics('intersection_proposal_completed', {
      improvement_count: selectedImprovements.length,
      traffic_control: conditions.trafficControl,
      crossing_type: conditions.crossingType,
    });
    reset();
    exitToExplore();
  };

  // Group selected improvements by category
  const grouped = new Map<string, typeof improvements>();
  const improvements = selectedImprovements
    .map((id) => IMPROVEMENT_BY_ID.get(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof IMPROVEMENT_BY_ID.get>>[];

  for (const imp of improvements) {
    if (!grouped.has(imp.category)) grouped.set(imp.category, []);
    grouped.get(imp.category)!.push(imp);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          aria-label="Back to improvements"
          className="flex min-h-11 min-w-11 items-center justify-center text-[#59646a] hover:bg-[#f3f5f5]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900">
          Intersection Proposal
        </h3>
      </div>

      {/* Intersection info */}
      <div className="bg-gray-50 rounded-sm p-3">
        <div className="text-[13px] font-semibold text-gray-900">{intersectionName}</div>
        <div className="text-xs text-[#59646a] mt-1">
          {conditions.trafficControl.replace(/-/g, ' ')} — {conditions.crossingType.replace(/-/g, ' ')}
        </div>
      </div>

      {/* Crash summary */}
      {crashSummary && crashSummary.totalCrashes > 0 && (
        <div className="bg-red-50 rounded-sm px-3.5 py-2.5 flex flex-col gap-1">
          <div className="text-xs font-bold text-red-800">
            {crashSummary.totalCrashes} crashes within {crashSummary.radiusMeters}m
          </div>
          <div className="flex items-center gap-3 text-xs text-red-600">
            {crashSummary.fatalities > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-sm bg-red-600" />
                {crashSummary.fatalities} recorded fatalities
              </span>
            )}
            {crashSummary.severeInjuries > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-sm bg-orange-500" />
                {crashSummary.severeInjuries} severe
              </span>
            )}
            {crashSummary.pedestrianCrashes > 0 && (
              <span>{crashSummary.pedestrianCrashes} pedestrian</span>
            )}
            {crashSummary.cyclistCrashes > 0 && (
              <span>{crashSummary.cyclistCrashes} cyclist</span>
            )}
          </div>
        </div>
      )}

      {/* Selected improvements */}
      <div className="flex flex-col gap-3 max-h-[35vh] overflow-y-auto -mr-1 pr-1">
        {[...grouped.entries()].map(([category, items]) => (
          <div key={category}>
            <div className="text-xs font-bold text-[#59646a] uppercase tracking-[0.15em] mb-1.5">
              {CATEGORY_LABELS[category] ?? category}
            </div>
            <div className="flex flex-col gap-1">
              {items.map((imp) => (
                <div key={imp.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 rounded-lg">
                  <span className="text-sm">{imp.icon}</span>
                  <span className="text-xs font-medium text-gray-800 flex-1">{imp.label}</span>
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded-sm text-[#4e5d66] bg-[#edf0f0]"

                  >
                    {COMPLEXITY_LABELS[imp.complexity]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <details><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Read the discussion brief</summary><IntersectionBrief /></details>
      <PrivateBriefDownload name={intersectionName} location={location} filename="intersection-discussion-brief.pdf" context={{ ...briefContext, briefId: proposalId ?? undefined, revisedAt: draft?.updatedAt, supportingEvidence: {
        title: 'Intersection conditions and ideas to discuss',
        capturedAt: createdAt ?? 'Not recorded',
        summary: `Resident-selected conditions: ${conditions.trafficControl.replace(/-/g, ' ')}; ${conditions.crossingType.replace(/-/g, ' ')}. These are approximate and need on-site review.`,
        details: improvements.map((item) => `${item.label}: ${item.description}`),
        sources: [],
      } }} />
      <p className="text-xs leading-relaxed text-[#59646a]">Save this private concept to My work. You can reopen it, revise it and keep notes on any response.</p>
      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleDone}
          className="min-h-11 flex-1 bg-[#172126] hover:bg-green-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
        >
          Save and finish
        </button>
      </div>
    </div>
  );
}
