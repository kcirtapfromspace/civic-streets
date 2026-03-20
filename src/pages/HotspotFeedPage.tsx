import { useState, useEffect, ComponentType } from 'react';

function HotspotFeedPlaceholder() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Hotspot Feed</h1>
        <p className="text-gray-500">
          Community-reported safety hotspots will appear here. Coming soon!
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="mt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function useDynamicComponent<P extends object>(
  loader: () => Promise<Record<string, unknown>>,
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
            ? (mod[namedExport] as ComponentType<P>)
            : (mod.default as ComponentType<P>);
        if (resolved) setComponent(() => resolved);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return Component;
}

export default function HotspotFeedPage() {
  const HotspotFeed = useDynamicComponent(
    () => import('@/features/community/HotspotFeed'),
    'HotspotFeed',
    HotspotFeedPlaceholder,
  );

  return (
    <div className="h-full overflow-y-auto">
      <HotspotFeed />
    </div>
  );
}
