import { useMemo } from 'react';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { useProposalStore } from '@/stores/proposal-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import type { BeforePreset } from '@/lib/types';

export function BeforeSelector() {
  const selectPreset = useProposalStore((s) => s.selectPreset);
  const goBack = useProposalStore((s) => s.goBack);
  const location = useProposalStore((s) => s.location);
  const crashes = useSafetyDataStore((s) => s.crashes);
  const isLoading = useSafetyDataStore((s) => s.isLoading);
  const enabled = useSafetyDataStore((s) => s.enabled);

  // Filter crashes within ~200m of proposal location
  const nearbyCrashSummary = useMemo(() => {
    if (!location || crashes.length === 0) return null;
    const RADIUS_DEG = 200 / 111320; // ~200m in degrees
    const nearby = crashes.filter((c) => {
      const dLat = c.lat - location.lat;
      const dLng = c.lng - location.lng;
      return Math.sqrt(dLat * dLat + dLng * dLng) <= RADIUS_DEG;
    });
    if (nearby.length === 0) return null;
    const fatal = nearby.filter((c) => c.severity === 'fatal').length;
    const injuries = nearby.filter((c) => c.injuries !== null && c.injuries > 0).length;
    return { total: nearby.length, fatal, injuries };
  }, [location, crashes]);

  return (
    <div className="flex flex-col gap-4">
      <button onClick={goBack} className="min-h-11 self-start text-xs font-medium text-[#59646a] hover:text-[#172126]">← Back to concern</button>
      <div>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">
          What does this street look like today?
        </h3>
        <p className="text-xs text-[#59646a] mt-1">
          Pick an approximate layout. You can adjust widths later; these are not street measurements.
        </p>
      </div>

      {/* Crash summary card */}
      {enabled && nearbyCrashSummary && (
        <div className="bg-red-50 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[11px] text-red-700 font-medium">
            {nearbyCrashSummary.total} recorded crash{nearbyCrashSummary.total !== 1 ? 'es' : ''} nearby
            {nearbyCrashSummary.fatal > 0 && (
              <span className="text-red-900 font-bold"> ({nearbyCrashSummary.fatal} fatal)</span>
            )}
            {nearbyCrashSummary.injuries > 0 && (
              <span>, {nearbyCrashSummary.injuries} with recorded injuries</span>
            )}
          </span>
        </div>
      )}
      {enabled && !nearbyCrashSummary && isLoading && (
        <div className="bg-gray-50 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-[11px] text-[#59646a]">Loading safety data...</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {BEFORE_PRESETS.map((preset, i) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            index={i}
            onClick={() => selectPreset(preset)}
          />
        ))}
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  index,
  onClick,
}: {
  preset: BeforePreset;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 p-3.5 rounded-sm border border-[#d8dddf] bg-white hover:border-[#172126] hover:bg-[#f3f5f5] transition-colors duration-150 text-left group active:scale-[0.98] animate-fade-up stagger-${index + 1}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 32" className="h-8 w-6 shrink-0 text-[#59646a]" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 2v28M21 2v28M12 2v6m0 4v8m0 4v6" />
      </svg>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-gray-900 group-hover:text-[#172126] transition-colors">
          {preset.label}
        </div>
        <div className="text-[11px] text-[#59646a] mt-0.5 leading-snug">
          {preset.description}
        </div>
        <div className="text-xs text-[#59646a] mt-1.5 font-medium">
          {preset.rowWidth} ft assumed width
        </div>
      </div>
    </button>
  );
}
