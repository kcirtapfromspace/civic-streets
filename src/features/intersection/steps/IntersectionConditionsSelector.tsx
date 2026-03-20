import { INTERSECTION_PRESETS } from '@/lib/presets/intersection-presets';
import { useIntersectionStore } from '@/stores/intersection-store';

export function IntersectionConditionsSelector() {
  const selectConditions = useIntersectionStore((s) => s.selectConditions);
  const crashSummary = useIntersectionStore((s) => s.crashSummary);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">
          What does this intersection look like today?
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Pick the closest match to current conditions.
        </p>
      </div>

      {crashSummary && crashSummary.totalCrashes > 0 && (
        <div className="bg-red-50 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[11px] text-red-700 font-medium">
            {crashSummary.totalCrashes} crash{crashSummary.totalCrashes !== 1 ? 'es' : ''} nearby
            {crashSummary.fatalities > 0 && (
              <span className="text-red-900 font-bold"> ({crashSummary.fatalities} fatal)</span>
            )}
            {crashSummary.pedestrianCrashes > 0 && (
              <span> — {crashSummary.pedestrianCrashes} pedestrian</span>
            )}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {INTERSECTION_PRESETS.map((preset, i) => (
          <button
            key={preset.id}
            onClick={() => selectConditions(preset.conditions)}
            className={`flex items-start gap-3 p-3.5 rounded-2xl ring-1 ring-gray-100 bg-gray-50/50 hover:ring-blue-200 hover:bg-blue-50/40 transition-all duration-300 ease-spring text-left group active:scale-[0.98] animate-fade-up stagger-${i + 1}`}
          >
            <span className="text-lg flex-shrink-0 mt-0.5">{preset.icon}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-700 transition-all duration-300 ease-spring">
                {preset.label}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                {preset.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
