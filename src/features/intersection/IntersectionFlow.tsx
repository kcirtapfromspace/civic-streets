import { useEffect, useRef } from 'react';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { IntersectionConditionsSelector } from './steps/IntersectionConditionsSelector';
import { ImprovementPicker } from './steps/ImprovementPicker';
import { IntersectionReview } from './steps/IntersectionReview';
import { IntersectionPurpose } from './IntersectionPurpose';

const STEPS = [
  { key: 'conditions', label: 'Conditions' },
  { key: 'improvements', label: 'Improvements' },
  { key: 'review', label: 'Review' },
] as const;

/**
 * Wizard orchestrator for intersection improvement proposals.
 * Preserves purpose and progress alongside the selected intersection.
 */
export function IntersectionFlow() {
  const step = useIntersectionStore((s) => s.step);
  const intersectionName = useIntersectionStore((s) => s.intersectionName);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { panelRef.current?.focus(); }, [step]);
  const storageError = useWorkDraftsStore((s) => s.storageError);
  const reset = useIntersectionStore((s) => s.reset);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);

  const handleClose = () => {
    if (!useIntersectionStore.getState().saveWork()) return;
    reset();
    exitToExplore();
  };

  return (
    <div ref={panelRef} role="region" aria-label="Intersection proposal" tabIndex={-1} className="focus-visible:outline-2 focus-visible:outline-[#172126] absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[420px] max-w-[calc(100vw-32px)] animate-fade-up">
      <div className="border border-[#d8dddf] rounded-sm bg-white shadow-sm">
        {/* Inner core */}
        <div className="bg-white overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100/80">
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[#59646a]">Draft</span>
              <span className="text-[13px] font-bold text-gray-900 tracking-tight truncate max-w-[260px]">
                {intersectionName || 'Intersection Improvement'}
              </span>
            </div>
            <button
              onClick={handleClose}
              aria-label="Save and close intersection"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-[#59646a] hover:bg-[#f3f5f5]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Step progress */}
          <div className="px-5 pt-3 pb-1">
            <StepIndicator current={step} />
          </div>

          {/* Step content */}
          <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto">
            {storageError ? <div role="alert" className="mb-3 text-sm text-red-800"><p>{storageError}</p><button className="min-h-11 underline" onClick={() => useIntersectionStore.getState().saveWork()}>Retry saving</button></div> : <p className="mb-3 text-xs text-[#59646a]">Saved privately in this browser · Find it in My work</p>}
            <IntersectionPurpose />
            {step === 'conditions' && <IntersectionConditionsSelector />}
            {step === 'improvements' && <ImprovementPicker />}
            {step === 'review' && <IntersectionReview />}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol aria-label="Intersection stages" className="flex items-center gap-2 mb-2">
      {STEPS.map((step, i) => (
        <li key={step.key} aria-current={i === currentIndex ? 'step' : undefined} className="flex flex-col gap-1.5 flex-1"><span className="text-xs text-[#59646a]">{step.label}</span>
          <div
            className={`h-1 flex-1 rounded-full transition-all duration-500 ease-spring ${
              i <= currentIndex ? 'bg-[#172126]' : 'bg-[#d8dddf]'
            }`}
          />
        </li>
      ))}
    </ol>
  );
}
