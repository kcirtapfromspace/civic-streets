import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { BeforeSelector } from './steps/BeforeSelector';
import { TransformationPicker } from './steps/TransformationPicker';
import { ProposalReview } from './steps/ProposalReview';

/**
 * Main wizard orchestrator for the proposal flow.
 * Renders as a floating card with double-bezel architecture.
 */
export function ProposalFlow() {
  const step = useProposalStore((s) => s.step);
  const streetName = useProposalStore((s) => s.streetName);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);
  const reset = useProposalStore((s) => s.reset);

  const handleClose = () => {
    reset();
    exitToExplore();
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[420px] max-w-[calc(100vw-32px)] animate-fade-up">
      {/* Outer shell — double-bezel */}
      <div className="bg-white/60 backdrop-blur-2xl p-1.5 rounded-[1.5rem] ring-1 ring-black/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]">
        {/* Inner core */}
        <div className="bg-white rounded-[calc(1.5rem-6px)] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100/80">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]" />
              <span className="text-[13px] font-bold text-gray-900 tracking-tight truncate max-w-[260px]">
                {streetName || 'Street Proposal'}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-300 hover:text-gray-500 transition-all duration-300 ease-spring p-1.5 -mr-1.5 rounded-full hover:bg-gray-100/80"
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
  { key: 'street-selected', label: 'Street' },
  { key: 'before-selected', label: 'Today' },
  { key: 'review', label: 'Proposal' },
] as const;

function StepIndicator({ current }: { current: string }) {
  const currentIndex = STEPS.findIndex(
    (s) => s.key === current || (current === 'transform-selected' && s.key === 'review'),
  );

  return (
    <div className="flex items-center gap-2 mb-2">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1.5 flex-1">
          <div
            className={`h-1 flex-1 rounded-full transition-all duration-500 ease-spring ${
              i <= currentIndex ? 'bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.3)]' : 'bg-gray-100'
            }`}
          />
        </div>
      ))}
    </div>
  );
}
