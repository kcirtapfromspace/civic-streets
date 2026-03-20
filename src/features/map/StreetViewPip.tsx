import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore, type DesignLocation } from '@/stores/workspace-store';

interface StreetViewPipProps {
  googleApi: typeof google | null;
}

/**
 * Picture-in-picture Street View panorama showing the real street
 * at the design location. Checks coverage before rendering.
 */
export function StreetViewPip({ googleApi }: StreetViewPipProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const designLocation = useWorkspaceStore((s) => s.designLocation);
  const showStreetViewPip = useWorkspaceStore((s) => s.showStreetViewPip);
  const toggleStreetViewPip = useWorkspaceStore((s) => s.toggleStreetViewPip);

  const [hasCoverage, setHasCoverage] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const dragOffset = useRef({ x: 0, y: 0 });

  // Check coverage and initialize Street View
  useEffect(() => {
    if (!googleApi || !designLocation || !showStreetViewPip || !containerRef.current) {
      return;
    }

    const sv = new googleApi.maps.StreetViewService();
    const location = { lat: designLocation.lat, lng: designLocation.lng };

    sv.getPanorama({ location, radius: 50 })
      .then((data) => {
        if (!containerRef.current) return;
        setHasCoverage(true);

        if (panoRef.current) {
          panoRef.current.setPosition(data.data.location!.latLng!);
        } else {
          panoRef.current = new googleApi.maps.StreetViewPanorama(
            containerRef.current,
            {
              position: data.data.location!.latLng!,
              pov: { heading: 0, pitch: 0 },
              zoom: 0,
              addressControl: false,
              showRoadLabels: false,
              motionTracking: false,
              motionTrackingControl: false,
            },
          );
        }
      })
      .catch(() => {
        setHasCoverage(false);
      });

    return () => {
      // Clean up panorama
      panoRef.current = null;
    };
  }, [googleApi, designLocation, showStreetViewPip]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!showStreetViewPip || !designLocation) return null;

  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{ right: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="w-[320px] h-[200px] rounded-lg overflow-hidden shadow-xl border border-gray-200 bg-gray-900 cursor-move">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 bg-gradient-to-b from-black/50 to-transparent">
          <span className="text-[10px] font-medium text-white/90">
            Street View
          </span>
          <button
            onClick={toggleStreetViewPip}
            className="p-0.5 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            aria-label="Close Street View"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
            </svg>
          </button>
        </div>

        {/* Panorama container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* No coverage fallback */}
        {hasCoverage === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center text-white/70 px-4">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">No Street View coverage at this location</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
