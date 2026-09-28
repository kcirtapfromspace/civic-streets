import { useProposalStore } from '@/stores/proposal-store';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

/** Keep map comparison available when the detailed editor dock is collapsed. */
export function MapComparison({ className = '' }: { className?: string }) {
  const mode = useWorkspaceStore((state) => state.mode);
  const linkedId = useWorkspaceStore((state) => state.designProposalId);
  const proposalId = useProposalStore((state) => state.proposalId);
  const roadPath = useProposalStore((state) => state.roadPath);
  const currentStreet = useStreetStore((state) => state.currentStreet);
  const beforeStreet = useStreetStore((state) => state.beforeStreet);
  const showBeforeAfter = useStreetStore((state) => state.showBeforeAfter);

  if (
    mode !== 'design' ||
    !linkedId ||
    linkedId !== proposalId ||
    roadPath.length < 2 ||
    !currentStreet
  )
    return null;
  const showingBefore = showBeforeAfter && !!beforeStreet;
  const buttonClass =
    'min-h-11 flex-1 rounded-sm px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172126]';
  return (
    <section
      aria-label="Map comparison"
      className={`pointer-events-auto w-56 max-w-full rounded-sm border border-[#d8dddf] bg-white p-2 shadow-sm ${className}`}
    >
      <div role="group" aria-label="Street shown on map" className="flex gap-1">
        <button
          type="button"
          disabled={!beforeStreet}
          aria-pressed={showingBefore}
          onClick={() => useStreetStore.setState({ showBeforeAfter: true })}
          title={beforeStreet ? undefined : 'No before layout has been recorded'}
          className={`${buttonClass} ${showingBefore ? 'bg-[#172126] text-white' : 'text-[#172126] hover:bg-[#f3f5f5]'} disabled:text-[#59646a] disabled:bg-[#f3f5f5] disabled:cursor-not-allowed`}
        >
          Before
        </button>
        <button
          type="button"
          aria-pressed={!showingBefore}
          onClick={() => useStreetStore.setState({ showBeforeAfter: false })}
          className={`${buttonClass} ${!showingBefore ? 'bg-[#172126] text-white' : 'text-[#172126] hover:bg-[#f3f5f5]'}`}
        >
          After
        </button>
      </div>
      <p role="status" className="mt-2 px-1 text-xs leading-5 text-[#59646a]">
        Showing {showingBefore ? 'before' : 'after'} · Approximate layout
      </p>
    </section>
  );
}
