import { useDrawingStore } from '@/stores/drawing-store';

export function DrawingActionCard() {
  const drawnGeometries = useDrawingStore((s) => s.drawnGeometries);
  const isSnapping = useDrawingStore((s) => s.isSnapping);
  const commitToProposal = useDrawingStore((s) => s.commitToProposal);
  const clearGeometries = useDrawingStore((s) => s.clearGeometries);
  const activeMode = useDrawingStore((s) => s.activeMode);

  const latest = drawnGeometries[drawnGeometries.length - 1];
  if (!latest || activeMode === 'cursor') return null;

  const hasSnapped = latest.snappedCoords !== null;
  const isFreehand = latest.mode === 'freehand';
  const isReady = isFreehand || hasSnapped;

  return (
    <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-10 animate-fade-up">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.06] p-4 flex flex-col gap-3 min-w-[260px]">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-sm font-semibold text-gray-900">
            {isSnapping
              ? 'Snapping to road...'
              : isReady
                ? latest.mode === 'circle'
                  ? 'Intersection selected'
                  : latest.mode === 'freehand'
                    ? 'Freehand path drawn'
                    : 'Road stretch selected'
                : 'Processing...'}
          </span>
        </div>

        {latest.mode !== 'freehand' && (
          <p className="text-xs text-gray-500">
            {hasSnapped
              ? `${latest.snappedCoords!.length} road points snapped`
              : `${latest.rawCoords.length} points drawn`}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={commitToProposal}
            disabled={!isReady}
            className="flex-1 flex items-center justify-center gap-2 text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed px-4 py-2.5 rounded-full transition-all duration-300 ease-spring active:scale-[0.98] shadow-[0_1px_3px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
            </svg>
            Design this stretch
          </button>

          <button
            onClick={clearGeometries}
            className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2.5 rounded-full transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022 1.005 11.36c.076.862.774 1.53 1.638 1.53h6.686c.864 0 1.562-.668 1.638-1.53l1.005-11.36.15.022a.75.75 0 10.228-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
