import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { IMPROVEMENT_BY_ID, CATEGORY_LABELS, COMPLEXITY_COLORS, COMPLEXITY_LABELS } from '@/lib/presets/intersection-improvements';

export function IntersectionReview() {
  const intersectionName = useIntersectionStore((s) => s.intersectionName);
  const conditions = useIntersectionStore((s) => s.conditions);
  const selectedImprovements = useIntersectionStore((s) => s.selectedImprovements);
  const crashSummary = useIntersectionStore((s) => s.crashSummary);
  const goBack = useIntersectionStore((s) => s.goBack);
  const reset = useIntersectionStore((s) => s.reset);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);

  if (!conditions) return null;

  const handleDone = () => {
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
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
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
      <div className="bg-gray-50 rounded-xl p-3">
        <div className="text-[13px] font-semibold text-gray-900">{intersectionName}</div>
        <div className="text-[11px] text-gray-400 mt-1">
          {conditions.trafficControl.replace(/-/g, ' ')} — {conditions.crossingType.replace(/-/g, ' ')}
        </div>
      </div>

      {/* Crash summary */}
      {crashSummary && crashSummary.totalCrashes > 0 && (
        <div className="bg-red-50 rounded-xl px-3.5 py-2.5 flex flex-col gap-1">
          <div className="text-[11px] font-bold text-red-800">
            {crashSummary.totalCrashes} crashes within {crashSummary.radiusMeters}m
          </div>
          <div className="flex items-center gap-3 text-[10px] text-red-600">
            {crashSummary.fatalities > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                {crashSummary.fatalities} fatal
              </span>
            )}
            {crashSummary.severeInjuries > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
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
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em] mb-1.5">
              {CATEGORY_LABELS[category] ?? category}
            </div>
            <div className="flex flex-col gap-1">
              {items.map((imp) => (
                <div key={imp.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 rounded-lg">
                  <span className="text-sm">{imp.icon}</span>
                  <span className="text-[11px] font-medium text-gray-800 flex-1">{imp.label}</span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      color: COMPLEXITY_COLORS[imp.complexity],
                      backgroundColor: `${COMPLEXITY_COLORS[imp.complexity]}15`,
                    }}
                  >
                    {COMPLEXITY_LABELS[imp.complexity]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleDone}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
