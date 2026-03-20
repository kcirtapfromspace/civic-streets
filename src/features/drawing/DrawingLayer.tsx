import type maplibregl from 'maplibre-gl';
import { useRoadPainter } from './useRoadPainter';

interface DrawingLayerProps {
  map: maplibregl.Map | null;
}

/**
 * Headless component: manages the drag-to-paint road drawing interaction.
 * All visual feedback is rendered via MapLibre layers in useRoadPainter.
 */
export function DrawingLayer({ map }: DrawingLayerProps) {
  useRoadPainter(map);
  return null;
}
