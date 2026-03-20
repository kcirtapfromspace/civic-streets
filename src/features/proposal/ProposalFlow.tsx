import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { BeforeSelector } from './steps/BeforeSelector';
import { TransformationPicker } from './steps/TransformationPicker';
import { ProposalReview } from './steps/ProposalReview';

/**
 * Main wizard orchestrator for the proposal flow.
 * Renders as a bottom sheet, driven by the proposal store's step machine.
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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[420px] max-w-[calc(100vw-32px)]">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-gray-900 truncate max-w-[260px]">
              {streetName || 'Street Proposal'}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Step progress */}
        <div className="px-4 pt-2.5 pb-1">
          <StepIndicator current={step} />
        </div>

        {/* Step content */}
        <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
          {step === 'street-selected' && <BeforeSelector />}
          {step === 'before-selected' && <TransformationPicker />}
          {(step === 'transform-selected' || step === 'review') && (
            <ProposalReview />
          )}
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
    <div className="flex items-center gap-1.5 mb-2">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1.5 flex-1">
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentIndex ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        </div>
      ))}
    </div>
  );
}
