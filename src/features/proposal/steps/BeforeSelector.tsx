import { BEFORE_PRESETS } from '@/lib/presets/before-presets';
import { useProposalStore } from '@/stores/proposal-store';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import type { BeforePreset } from '@/lib/types';
import { CrashCoverageStatus } from '@/features/safety-data/CrashCoverageStatus';
import { crashBriefEvidence } from '@/features/safety-data/brief-evidence';
import { useMapStore } from '@/features/map/map-store';

export function BeforeSelector() {
  const selectPreset = useProposalStore((s) => s.selectPreset);
  const goBack = useProposalStore((s) => s.goBack);
  const location = useProposalStore((s) => s.location);
  const safetyData = useSafetyDataStore();
  const zoom = useMapStore((s) => s.zoom);
  const savedEvidence = useProposalStore((s) => s.briefContext.supportingEvidence);
  const setContext = useProposalStore((s) => s.setBriefContext);
  const evidence = location ? crashBriefEvidence(location, safetyData) : null;

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

      {safetyData.enabled && <details className="border-y border-civic-line py-2 text-xs text-civic-muted">
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-civic-ink">Crash evidence and source coverage (optional)</summary>
        <CrashCoverageStatus zoom={zoom} />
        {evidence && <><p className="mt-3 leading-5">{evidence.summary}</p><button type="button" onClick={() => setContext({ supportingEvidence: evidence })} className="mt-2 min-h-11 underline">{savedEvidence ? 'Update snapshot in brief' : 'Include this snapshot in brief'}</button></>}
        {savedEvidence && <p role="status" className="mt-2 leading-5">A dated snapshot is saved with this brief. <button type="button" onClick={() => setContext({ supportingEvidence: undefined })} className="min-h-11 underline">Remove snapshot</button></p>}
        <p className="mt-2 leading-5">Your concern does not need crash records to be worth discussing.</p>
      </details>}

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
