import { useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';

/**
 * Returns an incrementing counter that bumps every time the map's style
 * finishes loading (e.g. after setStyle() swaps roadmap↔satellite).
 * Components add this counter to their useEffect deps to re-run layer
 * setup after style changes wipe custom sources/layers.
 */
export function useStyleReload(map: maplibregl.Map | null): number {
  const [styleVersion, setStyleVersion] = useState(0);

  useEffect(() => {
    if (!map) return;

    const onStyleLoad = () => {
      setStyleVersion((v) => v + 1);
    };

    map.on('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [map]);

  return styleVersion;
}
