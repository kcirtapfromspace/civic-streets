import { useMemo } from 'react';
import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { useProposalStore } from '@/stores/proposal-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import type { BeforePreset } from '@/lib/types';

const PRESET_ICONS: Record<string, string> = {
  '2-lane-residential': '🏘',
  '2-lane-with-parking': '🅿',
  '4-lane-no-median': '🚗',
  '4-lane-with-parking': '🏬',
  '4-lane-with-median': '🛣',
  '5-lane-center-turn': '↔',
};

export function BeforeSelector() {
  const selectPreset = useProposalStore((s) => s.selectPreset);
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
    const injuries = nearby.filter((c) => c.injuries > 0).length;
    return { total: nearby.length, fatal, injuries };
  }, [location, crashes]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">
          What does this street look like today?
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Pick the closest match — you can refine later.
        </p>
      </div>

      {/* Crash summary card */}
      {enabled && nearbyCrashSummary && (
        <div className="bg-red-50 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[11px] text-red-700 font-medium">
            {nearbyCrashSummary.total} crash{nearbyCrashSummary.total !== 1 ? 'es' : ''} nearby
            {nearbyCrashSummary.fatal > 0 && (
              <span className="text-red-900 font-bold"> ({nearbyCrashSummary.fatal} fatal)</span>
            )}
            {nearbyCrashSummary.injuries > 0 && (
              <span>, {nearbyCrashSummary.injuries} with injuries</span>
            )}
          </span>
        </div>
      )}
      {enabled && !nearbyCrashSummary && isLoading && (
        <div className="bg-gray-50 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-[11px] text-gray-400">Loading safety data...</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {BEFORE_PRESETS.map((preset, i) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            icon={PRESET_ICONS[preset.id] ?? '🛤'}
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
  icon,
  index,
  onClick,
}: {
  preset: BeforePreset;
  icon: string;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 p-3.5 rounded-2xl ring-1 ring-gray-100 bg-gray-50/50 hover:ring-blue-200 hover:bg-blue-50/40 transition-all duration-300 ease-spring text-left group active:scale-[0.98] animate-fade-up stagger-${index + 1}`}
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-700 transition-all duration-300 ease-spring">
          {preset.label}
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">
          {preset.description}
        </div>
        <div className="text-[10px] text-gray-300 mt-1.5 font-medium tracking-wide uppercase">
          {preset.rowWidth} ft ROW
        </div>
      </div>
    </button>
  );
}
