import type { ReactNode } from 'react';

interface EditorSidePanelProps {
  children: ReactNode;
  visible: boolean;
  side: 'left' | 'right';
  title: string;
  onClose: () => void;
}

/**
 * Animated slide-in panel for floating HUD overlays.
 * Used to wrap ElementList (left) and ValidationPanel (right).
 */
export function EditorSidePanel({
  children,
  visible,
  side,
  title,
  onClose,
}: EditorSidePanelProps) {
  const translateClass = side === 'left'
    ? (visible ? 'translate-x-0' : '-translate-x-full')
    : (visible ? 'translate-x-0' : 'translate-x-full');

  const positionClass = side === 'left' ? 'left-0' : 'right-0';

  return (
    <div
      className={`absolute ${positionClass} top-0 bottom-[280px] z-20 w-[300px] max-w-[85vw] transition-transform duration-300 ease-in-out ${translateClass} pointer-events-auto`}
      role="complementary"
      aria-label={title}
    >
      <div className="h-full bg-white/90 backdrop-blur-md border-r border-gray-200 shadow-lg flex flex-col overflow-hidden"
        style={side === 'right' ? { borderRight: 'none', borderLeft: '1px solid #e5e7eb' } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={`Close ${title}`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
            </svg>
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
