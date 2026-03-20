import { useMemo } from 'react';
import { useIntersectionStore } from '@/stores/intersection-store';
import { INTERSECTION_IMPROVEMENTS, CATEGORY_LABELS, COMPLEXITY_COLORS, COMPLEXITY_LABELS } from '@/lib/presets/intersection-improvements';
import { suggestImprovements } from '../suggestion-engine';
import type { ImprovementCategory } from '@/lib/types/intersection';

export function ImprovementPicker() {
  const conditions = useIntersectionStore((s) => s.conditions);
  const nearbyCrashes = useIntersectionStore((s) => s.nearbyCrashes);
  const selectedImprovements = useIntersectionStore((s) => s.selectedImprovements);
  const toggleImprovement = useIntersectionStore((s) => s.toggleImprovement);
  const advanceToReview = useIntersectionStore((s) => s.advanceToReview);
  const goBack = useIntersectionStore((s) => s.goBack);
  const crashSummary = useIntersectionStore((s) => s.crashSummary);

  const scored = useMemo(() => {
    if (!conditions) return [];
    return suggestImprovements(conditions, nearbyCrashes, INTERSECTION_IMPROVEMENTS);
  }, [conditions, nearbyCrashes]);

  // Group by category, preserving sort order
  const grouped = useMemo(() => {
    const groups = new Map<ImprovementCategory, typeof scored>();
    for (const item of scored) {
      const cat = item.improvement.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [scored]);

  if (!conditions) return null;

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
          Select improvements
        </h3>
      </div>

      {/* Crash summary header */}
      {crashSummary && crashSummary.totalCrashes > 0 && (
        <div className="bg-red-50 rounded-xl px-3.5 py-2.5">
          <span className="text-[11px] text-red-700 font-medium">
            {crashSummary.totalCrashes} crash{crashSummary.totalCrashes !== 1 ? 'es' : ''} nearby
            {crashSummary.pedestrianCrashes > 0 && ` (${crashSummary.pedestrianCrashes} pedestrian)`}
            {crashSummary.fatalities > 0 && (
              <span className="text-red-900 font-bold"> — {crashSummary.fatalities} fatal</span>
            )}
          </span>
        </div>
      )}

      {/* Improvement checklist grouped by category */}
      <div className="flex flex-col gap-4 max-h-[45vh] overflow-y-auto -mr-1 pr-1">
        {[...grouped.entries()].map(([category, items]) => (
          <div key={category}>
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em] mb-2">
              {CATEGORY_LABELS[category] ?? category}
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map(({ improvement: imp, isDataSuggested }) => {
                const isSelected = selectedImprovements.includes(imp.id);
                return (
                  <button
                    key={imp.id}
                    onClick={() => toggleImprovement(imp.id)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-blue-50 ring-1 ring-blue-200'
                        : 'bg-gray-50/50 ring-1 ring-gray-100 hover:ring-blue-100 hover:bg-blue-50/30'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-3 h-3">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] font-semibold text-gray-900">{imp.icon} {imp.label}</span>
                        {isDataSuggested && (
                          <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">
                            DATA-SUGGESTED
                          </span>
                        )}
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
                      <div className="text-[10px] text-gray-400 mt-0.5">{imp.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Continue button */}
      <button
        onClick={advanceToReview}
        disabled={selectedImprovements.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold py-2.5 rounded-full transition-all duration-300 ease-spring active:scale-[0.98] shadow-[0_1px_3px_rgba(37,99,235,0.3)]"
      >
        Continue with {selectedImprovements.length} improvement{selectedImprovements.length !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
