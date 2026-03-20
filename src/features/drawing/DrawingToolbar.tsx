import type { ReactNode } from 'react';
import { useDrawingStore, type DrawingMode } from '@/stores/drawing-store';

const MODES: Array<{ mode: DrawingMode; label: string; icon: ReactNode }> = [
  {
    mode: 'cursor',
    label: 'Select',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.414 1.415l.708-.708zm-7.071 7.072l.707-.708A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    mode: 'line',
    label: 'Line',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    mode: 'circle',
    label: 'Circle',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    mode: 'freehand',
    label: 'Draw',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
      </svg>
    ),
  },
];

export function DrawingToolbar() {
  const activeMode = useDrawingStore((s) => s.activeMode);
  const setActiveMode = useDrawingStore((s) => s.setActiveMode);
  const clearGeometries = useDrawingStore((s) => s.clearGeometries);
  const isSnapping = useDrawingStore((s) => s.isSnapping);

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.06] p-1.5 flex items-center gap-1">
        {MODES.map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => {
              if (mode === 'cursor' && activeMode !== 'cursor') {
                clearGeometries();
              }
              setActiveMode(mode);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all duration-300 ease-spring ${
              activeMode === mode
                ? 'bg-blue-600 text-white shadow-[0_1px_3px_rgba(37,99,235,0.3)]'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
            title={label}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}

        {isSnapping && (
          <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-blue-600 font-medium">
            <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            Snapping...
          </div>
        )}
      </div>
    </div>
  );
}
