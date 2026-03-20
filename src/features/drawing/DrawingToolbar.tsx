import { useDrawingStore, type DrawingTool } from '@/stores/drawing-store';

interface ToolConfig {
  tool: DrawingTool;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const TOOLS: ToolConfig[] = [
  {
    tool: 'road',
    label: 'Redesign Road',
    hint: 'drag along street',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M6 26L10 6h2l-3 18M20 26l3-18h2L22 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 8v3M15 14v3M15 20v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0.5 3" />
        <path d="M9 16l4-3v6l4-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      </svg>
    ),
  },
  {
    tool: 'intersection',
    label: 'Intersection',
    hint: 'click to mark',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 4v6M16 22v6M4 16h6M22 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="2.5" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  {
    tool: 'newroad',
    label: 'New Road',
    hint: 'draw freely',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M7 25c3-2 5-10 9-12s6 4 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="7" cy="25" r="2" fill="currentColor" opacity="0.5" />
        <path d="M24 6l2 1-1 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function getStatusText(tool: DrawingTool, isDragging: boolean, isSnapping: boolean, hasSelection: boolean): string {
  if (isSnapping) return 'Snapping to road...';
  if (isDragging) return 'Release to finish';
  if (hasSelection) return 'Road selected — design it or clear';
  switch (tool) {
    case 'road': return 'Click and drag along a road';
    case 'intersection': return 'Click on an intersection';
    case 'newroad': return 'Click and drag to draw a new road';
    default: return 'Select a tool to start building';
  }
}

export function DrawingToolbar() {
  const activeTool = useDrawingStore((s) => s.activeTool);
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const isDragging = useDrawingStore((s) => s.isDragging);
  const isSnapping = useDrawingStore((s) => s.isSnapping);
  const selectedPath = useDrawingStore((s) => s.selectedPath);
  const clear = useDrawingStore((s) => s.clear);

  const isActive = activeTool !== 'select';
  const statusText = isActive
    ? getStatusText(activeTool, isDragging, isSnapping, !!selectedPath)
    : null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-gray-900/92 backdrop-blur-xl rounded-2xl shadow-[0_8px_48px_rgba(0,0,0,0.3)] ring-1 ring-white/[0.08] flex flex-col items-center overflow-hidden">
        {/* Status bar */}
        {statusText && (
          <div className="w-full px-4 pt-2.5 pb-1.5 flex items-center justify-center gap-2">
            {isSnapping ? (
              <div className="w-3 h-3 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
            ) : isDragging ? (
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            ) : null}
            <span className="text-[11px] text-gray-400 font-medium">{statusText}</span>
          </div>
        )}

        {/* Tool buttons */}
        <div className="flex items-stretch gap-0.5 p-1.5">
          {TOOLS.map(({ tool, label, hint, icon }) => {
            const selected = activeTool === tool;

            return (
              <button
                key={tool}
                onClick={() => setActiveTool(selected ? 'select' : tool)}
                className={`group flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all duration-200 min-w-[100px] ${
                  selected
                    ? 'bg-blue-500 text-white shadow-[0_2px_12px_rgba(59,130,246,0.4)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <div className={`transition-transform duration-200 ${selected ? 'scale-110' : 'group-hover:scale-105'}`}>
                  {icon}
                </div>
                <span className="text-[11px] font-bold leading-tight">{label}</span>
                <span className={`text-[9px] leading-tight ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
                  {hint}
                </span>
              </button>
            );
          })}

          {/* Close / back to explore */}
          {isActive && (
            <button
              onClick={() => {
                clear();
                setActiveTool('select');
              }}
              className="flex items-center justify-center px-2 ml-0.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-white/[0.06] transition-all duration-200"
              title="Exit build mode (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
