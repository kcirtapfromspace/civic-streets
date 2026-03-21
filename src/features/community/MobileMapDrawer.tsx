import React, { useState, useRef, useCallback, useEffect } from 'react';

// Snap points as viewport-height fractions (from bottom)
const SNAP_PEEK = 0.3;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.9;
const SNAPS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];

// If dragged below this fraction, close the drawer
const CLOSE_THRESHOLD = 0.15;

interface MobileMapDrawerProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export function MobileMapDrawer({ open, onClose, children }: MobileMapDrawerProps) {
  const [snapFraction, setSnapFraction] = useState(SNAP_HALF);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startFraction = useRef(SNAP_HALF);
  const drawerRef = useRef<HTMLDivElement>(null);
  const currentFraction = useRef(SNAP_HALF);

  // Reset to half when opened
  useEffect(() => {
    if (open) {
      setSnapFraction(SNAP_HALF);
      currentFraction.current = SNAP_HALF;
    }
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragging.current = true;
    startY.current = e.touches[0].clientY;
    startFraction.current = currentFraction.current;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const deltaY = startY.current - e.touches[0].clientY;
    const vh = window.innerHeight;
    const newFraction = Math.max(0, Math.min(1, startFraction.current + deltaY / vh));
    currentFraction.current = newFraction;

    // Direct DOM manipulation for 60fps during drag
    if (drawerRef.current) {
      const translateY = (1 - newFraction) * 100;
      drawerRef.current.style.transform = `translateY(${translateY}%)`;
      drawerRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const frac = currentFraction.current;

    // Close if dragged below threshold
    if (frac < CLOSE_THRESHOLD) {
      if (drawerRef.current) {
        drawerRef.current.style.transition = '';
      }
      onClose();
      return;
    }

    // Snap to nearest point
    let nearest = SNAPS[0];
    let minDist = Math.abs(frac - SNAPS[0]);
    for (let i = 1; i < SNAPS.length; i++) {
      const dist = Math.abs(frac - SNAPS[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = SNAPS[i];
      }
    }

    currentFraction.current = nearest;
    setSnapFraction(nearest);

    // Re-enable CSS transition for the snap animation
    if (drawerRef.current) {
      drawerRef.current.style.transition = '';
      const translateY = (1 - nearest) * 100;
      drawerRef.current.style.transform = `translateY(${translateY}%)`;
    }
  }, [onClose]);

  if (!open) return null;

  const translateY = (1 - snapFraction) * 100;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          height: '100vh',
          transform: `translateY(${translateY}%)`,
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 z-10"
          aria-label="Close map"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Map content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
