import { useDrawingStore } from '@/stores/drawing-store';

/**
 * Appears inline above the build bar when a road stretch is selected.
 * Shows road info + "Design this stretch" / Clear actions.
 */
export function DrawingActionCard() {
  const selectedPath = useDrawingStore((s) => s.selectedPath);
  const activeTool = useDrawingStore((s) => s.activeTool);
  const isSnapping = useDrawingStore((s) => s.isSnapping);
  const streetName = useDrawingStore((s) => s.streetName);
  const commitToProposal = useDrawingStore((s) => s.commitToProposal);
  const clear = useDrawingStore((s) => s.clear);

  if (!selectedPath || selectedPath.length < 2 || activeTool === 'select') return null;

  // Approximate distance in meters
  const distance = selectedPath.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const prev = selectedPath[i - 1];
    const dLat = (p.lat - prev.lat) * 111320;
    const dLng = (p.lng - prev.lng) * 111320 * Math.cos((p.lat * Math.PI) / 180);
    return sum + Math.sqrt(dLat * dLat + dLng * dLng);
  }, 0);

  const distanceLabel =
    distance >= 1000
      ? `${(distance / 1000).toFixed(1)} km`
      : `${Math.round(distance)} m`;

  const toolLabel =
    streetName
      ? streetName
      : activeTool === 'intersection'
        ? 'Intersection'
        : activeTool === 'newroad'
          ? 'New road'
          : 'Road stretch';

  const color = activeTool === 'newroad' ? 'purple' : 'blue';

  return (
    <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-10 animate-fade-up">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] overflow-hidden">
        {/* Info strip */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isSnapping ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-gray-900">
              {streetName ? toolLabel : `${toolLabel} selected`}
            </span>
            <span className="text-[11px] text-gray-500">
              {streetName ? distanceLabel : `${selectedPath.length} points \u00b7 ${distanceLabel}`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={commitToProposal}
            className={`flex-1 flex items-center justify-center gap-2 text-[12px] font-bold text-white px-4 py-2.5 rounded-full transition-all duration-300 ease-spring active:scale-[0.97] ${
              activeTool === 'intersection'
                ? 'bg-orange-600 hover:bg-orange-500 shadow-[0_1px_3px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]'
                : color === 'purple'
                  ? 'bg-purple-600 hover:bg-purple-500 shadow-[0_1px_3px_rgba(139,92,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-[0_1px_3px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
            </svg>
            {activeTool === 'intersection' ? 'Improve this intersection' : 'Design this stretch'}
          </button>

          <button
            onClick={clear}
            className="flex items-center justify-center text-[12px] font-semibold text-gray-400 hover:text-red-500 px-3 py-2.5 rounded-full transition-all duration-200 hover:bg-red-50"
            title="Clear selection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
