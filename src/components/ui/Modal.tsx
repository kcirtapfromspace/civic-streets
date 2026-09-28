import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** For forms with their own guarded Cancel action; avoid losing work accidentally. */
  dismissible?: boolean;
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not(:disabled)',
    ),
  ).filter(
    (element) =>
      element.tabIndex >= 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
}

export function Modal({ isOpen, onClose, title, children, dismissible = true }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dismissalRef = useRef({ onClose, dismissible });
  const titleId = useId();

  // Inline parent callbacks change while typing. Update dismissal behavior without
  // re-running the dialog's opening focus and scroll-lock lifecycle.
  useEffect(() => {
    dismissalRef.current = { onClose, dismissible };
  }, [onClose, dismissible]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        const dismissal = dismissalRef.current;
        if (dismissal.dismissible) dismissal.onClose();
        return;
      }
      const root = overlayRef.current;
      if (event.key !== 'Tab' || !root) return;
      const focusable = focusableElements(root);
      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const frame = requestAnimationFrame(() => {
      const root = overlayRef.current;
      if (root) (focusableElements(root)[0] ?? root).focus();
    });
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.focus();
    };
  }, [isOpen]);

  // A form can replace its controls with a saving state. Keep focus in the
  // dialog if the focused control was removed, without disturbing text edits.
  useEffect(() => {
    if (isOpen && document.activeElement === document.body) overlayRef.current?.focus();
  }, [isOpen, children]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (dismissible && e.target === overlayRef.current) {
      onClose();
    }
  };

  const modal = (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172126]/45"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-[#ffffff] border border-[#d8dddf] rounded-sm shadow-lg max-w-4xl w-full mx-4 max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#d8dddf]">
          <h2 id={titleId} className="text-lg font-semibold text-[#172126]">
            {title}
          </h2>
          {dismissible && (
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="min-h-11 min-w-11 flex items-center justify-center text-gray-600 rounded hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#172126]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
