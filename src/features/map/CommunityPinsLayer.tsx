import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { HotspotPin, DesignPin } from '@/lib/types';
import {
  HOTSPOT_CATEGORY_COLORS,
  HOTSPOT_CATEGORY_LABELS,
  SEVERITY_LABELS,
} from '@/lib/types';
import { useMapStore } from './map-store';
import { useStyleReload } from './useStyleReload';
import { useHotspotsByBounds } from '@/lib/api/use-hotspots';
import { useDesignsByBounds } from '@/lib/api/use-designs';

interface CommunityPinsLayerProps {
  map: maplibregl.Map | null;
}

/** Scale marker size based on upvote count. */
function upvoteScale(upvotes: number): number {
  if (upvotes >= 150) return 18;
  if (upvotes >= 75) return 14;
  if (upvotes >= 30) return 11;
  return 9;
}

/** Create a colored circle SVG element for hotspot markers using DOM API. */
function createHotspotSvg(color: string, size: number): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.cursor = 'pointer';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size * 2));
  svg.setAttribute('height', String(size * 2));
  svg.setAttribute('viewBox', `0 0 ${size * 2} ${size * 2}`);

  const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  outerCircle.setAttribute('cx', String(size));
  outerCircle.setAttribute('cy', String(size));
  outerCircle.setAttribute('r', String(size - 1));
  outerCircle.setAttribute('fill', color);
  outerCircle.setAttribute('fill-opacity', '0.85');
  outerCircle.setAttribute('stroke', 'white');
  outerCircle.setAttribute('stroke-width', '2');

  const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  innerCircle.setAttribute('cx', String(size));
  innerCircle.setAttribute('cy', String(size));
  innerCircle.setAttribute('r', String(size * 0.3));
  innerCircle.setAttribute('fill', 'white');
  innerCircle.setAttribute('fill-opacity', '0.9');

  svg.appendChild(outerCircle);
  svg.appendChild(innerCircle);
  wrapper.appendChild(svg);
  return wrapper;
}

/** Create a blue pin SVG element for design markers using DOM API. */
function createDesignSvg(): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.cursor = 'pointer';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '36');
  svg.setAttribute('viewBox', '0 0 28 36');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z');
  path.setAttribute('fill', '#2563EB');
  path.setAttribute('stroke', 'white');
  path.setAttribute('stroke-width', '1.5');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '14');
  circle.setAttribute('cy', '13');
  circle.setAttribute('r', '6');
  circle.setAttribute('fill', 'white');
  circle.setAttribute('fill-opacity', '0.9');

  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  iconPath.setAttribute('d', 'M11 13l2-4 2 4M11 13h6M12 15v-2M16 15v-2');
  iconPath.setAttribute('stroke', '#2563EB');
  iconPath.setAttribute('stroke-width', '1.2');
  iconPath.setAttribute('fill', 'none');
  iconPath.setAttribute('stroke-linecap', 'round');

  svg.appendChild(path);
  svg.appendChild(circle);
  svg.appendChild(iconPath);
  wrapper.appendChild(svg);
  return wrapper;
}

/** Build popup DOM element for a hotspot. */
function buildHotspotPopupElement(pin: HotspotPin): HTMLDivElement {
  const color = HOTSPOT_CATEGORY_COLORS[pin.category];
  const categoryLabel = HOTSPOT_CATEGORY_LABELS[pin.category];
  const severityLabel = SEVERITY_LABELS[pin.severity];

  const container = document.createElement('div');
  container.style.maxWidth = '280px';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};`;
  const catText = document.createElement('span');
  catText.style.cssText = `font-size:11px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.5px;`;
  catText.textContent = categoryLabel;
  header.appendChild(dot);
  header.appendChild(catText);
  container.appendChild(header);

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 6px;font-size:15px;font-weight:600;color:#1a1a1a;line-height:1.3;';
  title.textContent = pin.title;
  container.appendChild(title);

  const stats = document.createElement('div');
  stats.style.cssText = 'display:flex;gap:12px;margin-top:10px;font-size:12px;color:#666;';
  const sevSpan = document.createElement('span');
  sevSpan.textContent = 'Severity: ';
  const sevStrong = document.createElement('strong');
  sevStrong.textContent = severityLabel;
  sevSpan.appendChild(sevStrong);
  const upvSpan = document.createElement('span');
  upvSpan.textContent = `${pin.upvotes} upvotes`;
  const cmtSpan = document.createElement('span');
  cmtSpan.textContent = `${pin.commentCount} comments`;
  stats.appendChild(sevSpan);
  stats.appendChild(upvSpan);
  stats.appendChild(cmtSpan);
  container.appendChild(stats);

  const linkWrapper = document.createElement('div');
  linkWrapper.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #eee;';
  const link = document.createElement('a');
  link.href = `/hotspot/${pin.id}`;
  link.style.cssText = 'font-size:13px;color:#2563EB;text-decoration:none;font-weight:500;';
  link.textContent = 'View Details \u2192';
  linkWrapper.appendChild(link);
  container.appendChild(linkWrapper);

  return container;
}

/** Build popup DOM element for a design. */
function buildDesignPopupElement(pin: DesignPin): HTMLDivElement {
  const complianceColor = pin.prowagPass ? '#16A34A' : '#DC2626';
  const complianceLabel = pin.prowagPass ? 'PROWAG Compliant' : 'Needs Review';

  const container = document.createElement('div');
  container.style.maxWidth = '280px';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
  const dot = document.createElement('span');
  dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;background:#2563EB;';
  const catText = document.createElement('span');
  catText.style.cssText = 'font-size:11px;font-weight:600;color:#2563EB;text-transform:uppercase;letter-spacing:0.5px;';
  catText.textContent = 'Community Design';
  header.appendChild(dot);
  header.appendChild(catText);
  container.appendChild(header);

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 6px;font-size:15px;font-weight:600;color:#1a1a1a;line-height:1.3;';
  title.textContent = pin.title;
  container.appendChild(title);

  const stats = document.createElement('div');
  stats.style.cssText = 'display:flex;gap:12px;margin-top:10px;font-size:12px;color:#666;';
  const compSpan = document.createElement('span');
  compSpan.style.cssText = `color:${complianceColor};font-weight:500;`;
  compSpan.textContent = complianceLabel;
  const upvSpan = document.createElement('span');
  upvSpan.textContent = `${pin.upvotes} upvotes`;
  stats.appendChild(compSpan);
  stats.appendChild(upvSpan);
  container.appendChild(stats);

  const linkWrapper = document.createElement('div');
  linkWrapper.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #eee;';
  const link = document.createElement('a');
  link.href = `/editor/${pin.id}`;
  link.style.cssText = 'font-size:13px;color:#2563EB;text-decoration:none;font-weight:500;';
  link.textContent = 'Open in Editor \u2192';
  linkWrapper.appendChild(link);
  container.appendChild(linkWrapper);

  return container;
}

export function CommunityPinsLayer({ map }: CommunityPinsLayerProps) {
  const showHotspots = useMapStore((s) => s.showHotspots);
  const showDesigns = useMapStore((s) => s.showDesigns);
  const showHeatmap = useMapStore((s) => s.showHeatmap);
  const styleVersion = useStyleReload(map);

  // Use data hooks instead of direct mock imports
  const { hotspots: hotspotPins } = useHotspotsByBounds();
  const { designs: designPins } = useDesignsByBounds();

  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const designMarkersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const getPopup = () => {
    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '320px',
      });
    }
    return popupRef.current;
  };

  // Hotspot markers
  useEffect(() => {
    if (!map) return;

    hotspotMarkersRef.current.forEach((m) => m.remove());
    hotspotMarkersRef.current = [];

    if (!showHotspots) return;

    const markers = hotspotPins.map((pin: HotspotPin) => {
      const color = HOTSPOT_CATEGORY_COLORS[pin.category];
      const size = upvoteScale(pin.upvotes);
      const el = createHotspotSvg(color, size);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        getPopup()
          .setLngLat([pin.lng, pin.lat])
          .setDOMContent(buildHotspotPopupElement(pin))
          .addTo(map);
      });

      return marker;
    });

    hotspotMarkersRef.current = markers;

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, showHotspots, hotspotPins]);

  // Design markers
  useEffect(() => {
    if (!map) return;

    designMarkersRef.current.forEach((m) => m.remove());
    designMarkersRef.current = [];

    if (!showDesigns) return;

    const markers = designPins.map((pin: DesignPin) => {
      const el = createDesignSvg();

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        getPopup()
          .setLngLat([pin.lng, pin.lat])
          .setDOMContent(buildDesignPopupElement(pin))
          .addTo(map);
      });

      return marker;
    });

    designMarkersRef.current = markers;

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, showDesigns, designPins]);

  // Heatmap layer via MapLibre heatmap layer
  useEffect(() => {
    if (!map) return;

    const sourceId = 'heatmap-source';
    const layerId = 'heatmap-layer';

    const cleanup = () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };

    cleanup();

    if (!showHeatmap) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: hotspotPins.map((pin) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
        properties: { weight: pin.upvotes },
      })),
    };

    const addHeatmap = () => {
      if (map.getSource(sourceId)) return;
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({
        id: layerId,
        type: 'heatmap',
        source: sourceId,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 200, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, '#fef3c7',
            0.4, '#fbbf24',
            0.6, '#f97316',
            0.8, '#ef4444',
            1, '#b91c1c',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 30],
          'heatmap-opacity': 0.6,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addHeatmap();
    } else {
      map.once('styledata', addHeatmap);
    }

    return cleanup;
  }, [map, showHeatmap, styleVersion, hotspotPins]);

  return null;
}
