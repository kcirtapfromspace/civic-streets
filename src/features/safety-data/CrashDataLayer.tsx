import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useSafetyDataStore } from './safety-data-store';
import { useStyleReload } from '@/features/map/useStyleReload';
import { SEVERITY_WEIGHTS, SEVERITY_COLORS } from '@/lib/types/safety-data';
import type { NormalizedCrash } from '@/lib/types/safety-data';

interface CrashDataLayerProps {
  map: maplibregl.Map | null;
}

const SOURCE_ID = 'crash-data-source';
const HEATMAP_LAYER = 'crash-heatmap-layer';
const POINTS_LAYER = 'crash-points-layer';

const MIN_ZOOM = 11;

export function CrashDataLayer({ map }: CrashDataLayerProps) {
  const crashes = useSafetyDataStore((s) => s.crashes);
  const enabled = useSafetyDataStore((s) => s.enabled);
  const showHeatmap = useSafetyDataStore((s) => s.showHeatmap);
  const showPoints = useSafetyDataStore((s) => s.showPoints);
  const filters = useSafetyDataStore((s) => s.filters);
  const fetchForBounds = useSafetyDataStore((s) => s.fetchForBounds);
  const styleVersion = useStyleReload(map);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced viewport fetch on moveend
  useEffect(() => {
    if (!map || !enabled) return;

    const onMoveEnd = () => {
      const zoom = map.getZoom();
      if (zoom < MIN_ZOOM) return;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const bounds = map.getBounds();
        fetchForBounds({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        });
      }, 500);
    };

    onMoveEnd();
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
      clearTimeout(debounceRef.current);
    };
  }, [map, enabled, fetchForBounds]);

  const getFiltered = useCallback((): NormalizedCrash[] => {
    return crashes.filter((c) => {
      if (!filters.modes.size || !c.modes.some((m) => filters.modes.has(m))) return false;
      if (!filters.severities.has(c.severity)) return false;
      if (filters.dateRange) {
        if (c.date < filters.dateRange.start || c.date > filters.dateRange.end) return false;
      }
      return true;
    });
  }, [crashes, filters]);

  // Render layers
  useEffect(() => {
    if (!map) return;

    const cleanup = () => {
      if (map.getLayer(HEATMAP_LAYER)) map.removeLayer(HEATMAP_LAYER);
      if (map.getLayer(POINTS_LAYER)) map.removeLayer(POINTS_LAYER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };

    cleanup();
    if (!enabled || crashes.length === 0) return;

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return;

      const data = getFiltered();
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: data.map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
          properties: {
            id: c.id,
            severity: c.severity,
            weight: SEVERITY_WEIGHTS[c.severity],
            fatalities: c.fatalities,
            injuries: c.injuries,
            date: c.date,
            modes: c.modes.join(', '),
            color: SEVERITY_COLORS[c.severity],
          },
        })),
      };

      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      if (showHeatmap) {
        map.addLayer({
          id: HEATMAP_LAYER,
          type: 'heatmap',
          source: SOURCE_ID,
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 18, 3],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.2, '#fed7aa',
              0.4, '#fb923c',
              0.6, '#ea580c',
              0.8, '#dc2626',
              1, '#7f1d1d',
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 18, 30],
            'heatmap-opacity': 0.65,
          },
        });
      }

      if (showPoints) {
        map.addLayer({
          id: POINTS_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 18, 8],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.8,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once('styledata', addLayers);
    }

    return cleanup;
  }, [map, enabled, crashes, showHeatmap, showPoints, filters, styleVersion, getFiltered]);

  // Click handler for point popups
  useEffect(() => {
    if (!map || !enabled || !showPoints) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [POINTS_LAYER] });
      if (!features.length) return;

      const props = features[0].properties!;
      const coords = (features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];

      const container = document.createElement('div');
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.maxWidth = '240px';

      const severityColor = String(props.color || '#6B7280');

      // Header with severity dot + label
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${severityColor}`;
      const label = document.createElement('span');
      label.style.cssText = `font-size:11px;font-weight:600;color:${severityColor};text-transform:uppercase`;
      label.textContent = String(props.severity);
      header.appendChild(dot);
      header.appendChild(label);
      container.appendChild(header);

      // Helper: create a labeled info line using safe DOM methods
      const addLine = (labelText: string, valueText: string) => {
        const div = document.createElement('div');
        div.style.cssText = 'font-size:12px;color:#374151;margin-bottom:4px';
        const strong = document.createElement('strong');
        strong.textContent = labelText;
        div.appendChild(strong);
        div.appendChild(document.createTextNode(` ${valueText}`));
        container.appendChild(div);
      };

      addLine('Date:', String(props.date));
      addLine('Modes:', String(props.modes));

      if (Number(props.fatalities) > 0) {
        const div = document.createElement('div');
        div.style.cssText = 'font-size:12px;color:#DC2626;font-weight:600';
        div.textContent = `${props.fatalities} fatalities`;
        container.appendChild(div);
      }
      if (Number(props.injuries) > 0) {
        const div = document.createElement('div');
        div.style.cssText = 'font-size:12px;color:#EA580C';
        div.textContent = `${props.injuries} injuries`;
        container.appendChild(div);
      }

      new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
        .setLngLat(coords)
        .setDOMContent(container)
        .addTo(map);
    };

    map.on('click', POINTS_LAYER, onClick);
    return () => {
      map.off('click', POINTS_LAYER, onClick);
    };
  }, [map, enabled, showPoints]);

  return null;
}
