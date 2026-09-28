import { useEffect, useRef, useState } from 'react';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { BeforeSelector } from './steps/BeforeSelector';
import { TransformationPicker } from './steps/TransformationPicker';
import { ProposalReview } from './steps/ProposalReview';
import { ConcernFields, ConcernStep } from './steps/ConcernStep';

/**
 * Main wizard orchestrator for the proposal flow.
 * Keeps proposal editing and explicit draft actions together above the map.
 */
export function ProposalFlow() {
  const step = useProposalStore((s) => s.step);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { panelRef.current?.focus(); }, [step]);
  const streetName = useProposalStore((s) => s.streetName);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);
  const reset = useProposalStore((s) => s.reset);

  const [closeError, setCloseError] = useState<string | null>(null);
  const handleClose = () => {
    const proposal = useProposalStore.getState().getProposal();
    try {
      if (proposal) {
        useSavedProposalsStore.getState().saveProposal(proposal);
        reset();
      }
      exitToExplore();
    } catch (error) {
      setCloseError((error as Error).message);
    }
  };

  return (
    <div ref={panelRef} role="region" aria-label="Street proposal" tabIndex={-1} className="focus-visible:outline-2 focus-visible:outline-[#d8dddf] absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[420px] max-w-[calc(100vw-32px)] animate-fade-up">
      <div className="border border-[#d8dddf] rounded-sm bg-[#ffffff] text-[#172126] shadow-sm">
        <div className="overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100/80">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] uppercase tracking-[0.16em] text-[#59646a]">Draft</span>
              <span className="text-[13px] font-bold text-gray-900 tracking-tight truncate max-w-[260px]">
                {streetName || 'Street Proposal'}
              </span>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close proposal"
              className="min-h-11 min-w-11 flex items-center justify-center text-[#59646a] hover:text-[#172126] hover:bg-[#f3f5f5] rounded-sm"
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

          {closeError && <p role="alert" className="px-5 py-2 text-xs text-red-700">{closeError}</p>}
          {/* Step content */}
          <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto">
            {step === 'concern' && <ConcernStep />}
            {step !== 'concern' && (
              <details className="mb-4 border-b border-[#d8dddf] pb-2">
                <summary className="min-h-11 cursor-pointer content-center text-xs font-medium text-[#172126]">Concern &amp; evidence</summary>
                <div className="pb-2"><ConcernFields /></div>
              </details>
            )}
            {step === 'street-selected' && <BeforeSelector />}
            {step === 'before-selected' && <TransformationPicker />}
            {(step === 'transform-selected' || step === 'review') && (
              <ProposalReview />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { key: 'concern', label: 'Concern' },
  { key: 'explore', label: 'Explore' },
  { key: 'review', label: 'Brief' },
] as const;

function StepIndicator({ current }: { current: string }) {
  const currentIndex = current === 'concern' ? 0 : current === 'street-selected' || current === 'before-selected' ? 1 : 2;

  return (
    <ol aria-label="Proposal stages" className="flex items-center gap-2 mb-2">
      {STEPS.map((step, i) => (
        <li key={step.key} aria-current={i === currentIndex ? 'step' : undefined} className="flex flex-col gap-1.5 flex-1">
          <span className={`text-[11px] ${i === currentIndex ? 'font-semibold text-[#172126]' : 'text-[#59646a]'}`}>{step.label}</span>
          <div
            className={`h-0.5 rounded-full ${
              i <= currentIndex ? 'bg-[#172126]' : 'bg-[#d8dddf]'
            }`}
          />
        </li>
      ))}
    </ol>
  );
}
