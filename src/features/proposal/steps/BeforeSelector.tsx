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
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">
          What does this street look like today?
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Pick the closest match — you can refine later.
        </p>
      </div>

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
