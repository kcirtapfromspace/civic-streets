import { Suspense, lazy, useState, useEffect, ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';

function MapPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <p className="text-gray-600 text-lg font-medium">Map View</p>
        <p className="text-gray-400 text-sm">Loading map experience...</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

/**
 * Dynamically tries to load a component at runtime.
 * Returns placeholder if module does not exist.
 */
function useDynamicComponent<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> } | { [key: string]: ComponentType<P> }>,
  namedExport: string | null,
  Fallback: ComponentType<P>,
): ComponentType<P> {
  const [Component, setComponent] = useState<ComponentType<P>>(() => Fallback);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((mod) => {
        if (cancelled) return;
        const resolved =
          namedExport && namedExport in mod
            ? (mod as Record<string, ComponentType<P>>)[namedExport]
            : (mod as { default: ComponentType<P> }).default;
        if (resolved) setComponent(() => resolved);
      })
      .catch(() => {
        // Module not available — keep fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return Component;
}

export default function MapPage() {
  const { showToast } = useToast();

  const MapView = useDynamicComponent(
    () => import('@/features/map/MapView'),
    'MapView',
    MapPlaceholder,
  );

  return (
    <div className="relative h-full">
      <MapView />

      {/* Floating Action Buttons */}
      <div className="absolute bottom-20 right-4 lg:bottom-6 lg:right-6 flex flex-col gap-3 z-10">
        {/* Report Hotspot FAB */}
        <button
          onClick={() => showToast('Hotspot reporting coming soon!', 'info')}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-full shadow-lg transition-colors text-sm font-medium"
          aria-label="Report a hotspot"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
          <span className="hidden sm:inline">Report Hotspot</span>
        </button>

        {/* Design a Street FAB */}
        <Link
          to="/editor"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors text-sm font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 21L12 12L21 3" />
            <path d="M15 6L18 3L21 6L18 9" />
            <path d="M3 15L6 12L9 15L6 18Z" />
          </svg>
          <span className="hidden sm:inline">Design a Street</span>
        </Link>
      </div>
    </div>
  );
}
