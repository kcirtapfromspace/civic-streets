import { useState, useEffect, ComponentType } from 'react';

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
  const MapView = useDynamicComponent(
    () => import('@/features/map/MapView'),
    'MapView',
    MapPlaceholder,
  );

  return (
    <div className="relative h-full">
      <MapView />
    </div>
  );
}
