import { useEffect, useRef } from 'react';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ELEMENT_COLORS } from '@/lib/constants/colors';
import { offsetPolyline, computeElementOffsets } from './utils/offset-polyline';
import type { CrossSectionElement, ElementType } from '@/lib/types';

interface MapOverlayProps {
  map: google.maps.Map | null;
}

/**
 * Renders colored polylines on the map representing each cross-section element.
 * Shows the "before" or "after" street based on the toggle state.
 */
export function MapOverlay({ map }: MapOverlayProps) {
  const mode = useWorkspaceStore((s) => s.mode);
  const roadPath = useProposalStore((s) => s.roadPath);
  const beforeStreet = useProposalStore((s) => s.beforeStreet);
  const afterStreet = useProposalStore((s) => s.afterStreet);
  const showBeforeOnMap = useProposalStore((s) => s.showBeforeOnMap);
  const step = useProposalStore((s) => s.step);

  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const highlightRef = useRef<google.maps.Polyline | null>(null);

  // Cleanup polylines on unmount
  useEffect(() => {
    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
      highlightRef.current?.setMap(null);
      highlightRef.current = null;
    };
  }, []);

  // Draw road highlight (blue) when street is selected
  useEffect(() => {
    if (!map || roadPath.length < 2 || mode !== 'propose') {
      highlightRef.current?.setMap(null);
      highlightRef.current = null;
      return;
    }

    if (!highlightRef.current) {
      highlightRef.current = new google.maps.Polyline({
        path: roadPath,
        strokeColor: '#3B82F6',
        strokeWeight: 6,
        strokeOpacity: 0.5,
        zIndex: 1,
        map,
      });
    } else {
      highlightRef.current.setPath(roadPath);
      highlightRef.current.setMap(map);
    }

    return () => {
      highlightRef.current?.setMap(null);
      highlightRef.current = null;
    };
  }, [map, roadPath, mode]);

  // Draw element polylines
  useEffect(() => {
    // Clear previous
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || roadPath.length < 2 || mode !== 'propose') return;

    // Determine which street to show
    const street = (step === 'review' || step === 'transform-selected')
      ? (showBeforeOnMap ? beforeStreet : afterStreet)
      : beforeStreet;

    if (!street) return;

    const offsets = computeElementOffsets(
      street.elements,
      street.totalROWWidth,
    );

    const polylines: google.maps.Polyline[] = [];

    street.elements.forEach((element: CrossSectionElement, i: number) => {
      const { centerOffset, width } = offsets[i];
      const colors = ELEMENT_COLORS[element.type as ElementType];
      if (!colors) return;

      // Create polyline at the element's offset from centerline
      const path = offsetPolyline(roadPath, centerOffset);

      const polyline = new google.maps.Polyline({
        path,
        strokeColor: colors.fill,
        strokeWeight: Math.max(2, width * 0.8),
        strokeOpacity: 0.75,
        zIndex: 10 + i,
        map,
      });

      polylines.push(polyline);
    });

    polylinesRef.current = polylines;

    return () => {
      polylines.forEach((p) => p.setMap(null));
    };
  }, [map, roadPath, beforeStreet, afterStreet, showBeforeOnMap, step, mode]);

  return null;
}
