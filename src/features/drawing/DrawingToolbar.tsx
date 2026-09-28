import { useEffect, useId, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
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
        <path
          d="M6 26L10 6h2l-3 18M20 26l3-18h2L22 26"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M15 8v3M15 14v3M15 20v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="0.5 3"
        />
        <path
          d="M9 16l4-3v6l4-3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
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
        <path
          d="M16 4v6M16 22v6M4 16h6M22 16h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
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
        <path
          d="M7 25c3-2 5-10 9-12s6 4 9-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="7" cy="25" r="2" fill="currentColor" opacity="0.5" />
        <path
          d="M24 6l2 1-1 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function getStatusText(
  tool: DrawingTool,
  isDragging: boolean,
  isSnapping: boolean,
  hasSelection: boolean,
): string {
  if (isSnapping) return 'Snapping to road...';
  if (isDragging) return 'Release to finish';
  if (hasSelection) return 'Road selected — design it or clear';
  switch (tool) {
    case 'road':
      return 'Click and drag along a road';
    case 'intersection':
      return 'Click on an intersection';
    case 'newroad':
      return 'Click and drag to draw a new road';
    default:
      return 'Select a tool to start building';
  }
}

export function DrawingToolbar() {
  const activeTool = useDrawingStore((s) => s.activeTool);
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const isDragging = useDrawingStore((s) => s.isDragging);
  const isSnapping = useDrawingStore((s) => s.isSnapping);
  const selectedPath = useDrawingStore((s) => s.selectedPath);
  const clear = useDrawingStore((s) => s.clear);

  const workspaceMode = useWorkspaceStore((s) => s.mode);
  const [isExpanded, setIsExpanded] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const toolsId = useId();
  const isActive = activeTool !== 'select';
  const statusText = getStatusText(activeTool, isDragging, isSnapping, !!selectedPath);
  const isOpen = isExpanded || isActive;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isOpen || workspaceMode !== 'explore') return;
      clear();
      setActiveTool('select');
      setIsExpanded(false);
      launcherRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, clear, setActiveTool, workspaceMode]);

  if (workspaceMode !== 'explore') return null;

  return (
    <div
      className="absolute bottom-4 left-3 z-30 flex flex-col items-start gap-2 sm:left-4"
      data-drawing-tools
    >
      {isOpen && (
        <section
          id={toolsId}
          aria-label="Drawing tools"
          className="max-h-[45dvh] w-[min(320px,calc(100vw-88px))] overflow-y-auto overscroll-contain rounded-lg border border-[#d8dddf] bg-white p-2 text-[#172126]"
        >
          <p role="status" className="px-2 py-2 text-xs leading-5 text-[#59646a]">
            {statusText}
          </p>
          <div className="grid grid-cols-1 gap-1">
            {TOOLS.map(({ tool, label, hint, icon }) => {
              const selected = activeTool === tool;
              return (
                <button
                  type="button"
                  key={tool}
                  aria-pressed={selected}
                  onClick={() => setActiveTool(selected ? 'select' : tool)}
                  className={`flex min-h-12 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172126] ${selected ? 'bg-[#172126] text-white' : 'hover:bg-[#f3f5f5]'}`}
                >
                  <span aria-hidden="true">{icon}</span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold">{label}</span>
                    <span
                      className={`text-[11px] ${selected ? 'text-white/80' : 'text-[#59646a]'}`}
                    >
                      {hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {isActive && (
            <button
              type="button"
              onClick={() => {
                clear();
                setActiveTool('select');
              }}
              title="Exit build mode (Esc)"
              className="mt-1 min-h-11 w-full rounded-md px-3 text-left text-xs font-semibold text-[#172126] hover:bg-[#f3f5f5] focus-visible:outline-2 focus-visible:outline-[#172126]"
            >
              Stop drawing
            </button>
          )}
        </section>
      )}
      <button
        ref={launcherRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={toolsId}
        onClick={() => {
          if (isOpen) {
            clear();
            setActiveTool('select');
          }
          setIsExpanded(!isOpen);
        }}
        className="min-h-11 rounded-lg border border-[#d8dddf] bg-white px-3 text-xs font-semibold text-[#172126] transition-colors hover:bg-[#f3f5f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172126]"
      >
        {isOpen ? 'Close draw tools' : 'Draw tools'}
      </button>
    </div>
  );
}
