import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { useProposalStore } from '@/stores/proposal-store';
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

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          What does this street look like today?
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Pick the closest match — you can refine later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {BEFORE_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            icon={PRESET_ICONS[preset.id] ?? '🛤'}
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
  onClick,
}: {
  preset: BeforePreset;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left group"
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
          {preset.label}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
          {preset.description}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          {preset.rowWidth} ft ROW
        </div>
      </div>
    </button>
  );
}
