import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op if used outside provider (graceful degradation)
    return { showToast: () => {} };
  }
  return ctx;
}

// ── Styles by type ──────────────────────────────────────────────────────────

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
};

const typeIcons: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u24D8',
};

// ── Single Toast ────────────────────────────────────────────────────────────

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all animate-[slideIn_0.2s_ease-out] ${typeStyles[item.type]}`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {typeIcons[item.type]}
      </span>
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="ml-2 opacity-70 hover:opacity-100 text-base leading-none"
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
}

// ── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [],
  );

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const timer = setTimeout(() => dismiss(oldest.id), 4000);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — bottom-right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
