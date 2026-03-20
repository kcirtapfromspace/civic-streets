import { useWorkspaceStore } from '@/stores/workspace-store';

/**
 * Street View picture-in-picture placeholder.
 * Google Street View has been removed as part of the MapLibre migration.
 * This component shows a placeholder message when toggled on.
 */
export function StreetViewPip() {
  const showStreetViewPip = useWorkspaceStore((s) => s.showStreetViewPip);
  const toggleStreetViewPip = useWorkspaceStore((s) => s.toggleStreetViewPip);

  if (!showStreetViewPip) return null;

  return (
    <div className="absolute z-30 right-4 top-4 pointer-events-auto">
      <div className="w-[320px] h-[200px] rounded-lg overflow-hidden shadow-xl border border-gray-200 bg-gray-900 flex items-center justify-center relative">
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 bg-gradient-to-b from-black/50 to-transparent">
          <span className="text-[10px] font-medium text-white/90">
            Street View
          </span>
          <button
            onClick={toggleStreetViewPip}
            className="p-0.5 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            aria-label="Close Street View"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
            </svg>
          </button>
        </div>

        <div className="text-center text-white/70 px-4">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-xs">Street View not available with OpenStreetMap</p>
          <p className="text-[10px] text-white/40 mt-1">Coming soon via Mapillary</p>
        </div>
      </div>
    </div>
  );
}
