import { useEffect, useRef, useCallback } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { HotspotPin, DesignPin } from '@/lib/types';
import {
  HOTSPOT_CATEGORY_COLORS,
  HOTSPOT_CATEGORY_LABELS,
  SEVERITY_LABELS,
} from '@/lib/types';
import { useMapStore } from './map-store';
import { MOCK_HOTSPOTS, MOCK_DESIGNS } from './mock-data';

interface CommunityPinsLayerProps {
  map: google.maps.Map | null;
  googleApi: typeof google | null;
}

/** Scale marker size based on upvote count. */
function upvoteScale(upvotes: number): number {
  if (upvotes >= 150) return 18;
  if (upvotes >= 75) return 14;
  if (upvotes >= 30) return 11;
  return 9;
}

/** Create a colored circle SVG element for hotspot markers using DOM API. */
function createHotspotSvg(
  color: string,
  size: number,
): HTMLDivElement {
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

/** Build the info window content element for a hotspot. */
function buildHotspotInfoElement(pin: HotspotPin): HTMLDivElement {
  const color = HOTSPOT_CATEGORY_COLORS[pin.category];
  const categoryLabel = HOTSPOT_CATEGORY_LABELS[pin.category];
  const severityLabel = SEVERITY_LABELS[pin.severity];

  const container = document.createElement('div');
  container.style.maxWidth = '280px';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  // Category header
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

  // Title
  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 6px;font-size:15px;font-weight:600;color:#1a1a1a;line-height:1.3;';
  title.textContent = pin.title;
  container.appendChild(title);

  // Stats row
  const stats = document.createElement('div');
  stats.style.cssText = 'display:flex;gap:12px;margin-top:10px;font-size:12px;color:#666;';
  const sevSpan = document.createElement('span');
  sevSpan.textContent = `Severity: `;
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

  // Link
  const linkWrapper = document.createElement('div');
  linkWrapper.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #eee;';
  const link = document.createElement('a');
  link.href = `#/hotspot/${pin.id}`;
  link.style.cssText = 'font-size:13px;color:#2563EB;text-decoration:none;font-weight:500;';
  link.textContent = 'View Details \u2192';
  linkWrapper.appendChild(link);
  container.appendChild(linkWrapper);

  return container;
}

/** Build the info window content element for a design. */
function buildDesignInfoElement(pin: DesignPin): HTMLDivElement {
  const complianceColor = pin.prowagPass ? '#16A34A' : '#DC2626';
  const complianceLabel = pin.prowagPass ? 'PROWAG Compliant' : 'Needs Review';

  const container = document.createElement('div');
  container.style.maxWidth = '280px';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  // Category header
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

  // Title
  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 6px;font-size:15px;font-weight:600;color:#1a1a1a;line-height:1.3;';
  title.textContent = pin.title;
  container.appendChild(title);

  // Stats row
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

  // Link
  const linkWrapper = document.createElement('div');
  linkWrapper.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #eee;';
  const link = document.createElement('a');
  link.href = `#/design/${pin.id}`;
  link.style.cssText = 'font-size:13px;color:#2563EB;text-decoration:none;font-weight:500;';
  link.textContent = 'Open in Editor \u2192';
  linkWrapper.appendChild(link);
  container.appendChild(linkWrapper);

  return container;
}

export function CommunityPinsLayer({
  map,
  googleApi,
}: CommunityPinsLayerProps) {
  const showHotspots = useMapStore((s) => s.showHotspots);
  const showDesigns = useMapStore((s) => s.showDesigns);
  const showHeatmap = useMapStore((s) => s.showHeatmap);

  // Refs to track created objects for cleanup
  const hotspotMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>(
    [],
  );
  const designMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>(
    [],
  );
  const hotspotClustererRef = useRef<MarkerClusterer | null>(null);
  const designClustererRef = useRef<MarkerClusterer | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(
    null,
  );
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Lazily create a shared InfoWindow
  const getInfoWindow = useCallback(() => {
    if (!googleApi) return null;
    if (!infoWindowRef.current) {
      infoWindowRef.current = new googleApi.maps.InfoWindow();
    }
    return infoWindowRef.current;
  }, [googleApi]);

  // ─── Hotspot markers ───────────────────────────────────
  useEffect(() => {
    if (!map || !googleApi) return;

    // Clean up previous markers
    hotspotClustererRef.current?.clearMarkers();
    hotspotMarkersRef.current.forEach((m) => (m.map = null));
    hotspotMarkersRef.current = [];

    if (!showHotspots) return;

    const markers = MOCK_HOTSPOTS.map((pin: HotspotPin) => {
      const color = HOTSPOT_CATEGORY_COLORS[pin.category];
      const size = upvoteScale(pin.upvotes);
      const content = createHotspotSvg(color, size);

      const marker = new googleApi.maps.marker.AdvancedMarkerElement({
        position: { lat: pin.lat, lng: pin.lng },
        content,
        title: pin.title,
      });

      marker.addListener('click', () => {
        const iw = getInfoWindow();
        if (iw) {
          iw.setContent(buildHotspotInfoElement(pin));
          iw.open({ anchor: marker, map });
        }
      });

      return marker;
    });

    hotspotMarkersRef.current = markers;

    // Create clusterer
    hotspotClustererRef.current = new MarkerClusterer({
      map,
      markers,
    });

    return () => {
      hotspotClustererRef.current?.clearMarkers();
      hotspotMarkersRef.current.forEach((m) => (m.map = null));
      hotspotMarkersRef.current = [];
    };
  }, [map, googleApi, showHotspots, getInfoWindow]);

  // ─── Design markers ────────────────────────────────────
  useEffect(() => {
    if (!map || !googleApi) return;

    designClustererRef.current?.clearMarkers();
    designMarkersRef.current.forEach((m) => (m.map = null));
    designMarkersRef.current = [];

    if (!showDesigns) return;

    const markers = MOCK_DESIGNS.map((pin: DesignPin) => {
      const content = createDesignSvg();

      const marker = new googleApi.maps.marker.AdvancedMarkerElement({
        position: { lat: pin.lat, lng: pin.lng },
        content,
        title: pin.title,
      });

      marker.addListener('click', () => {
        const iw = getInfoWindow();
        if (iw) {
          iw.setContent(buildDesignInfoElement(pin));
          iw.open({ anchor: marker, map });
        }
      });

      return marker;
    });

    designMarkersRef.current = markers;

    designClustererRef.current = new MarkerClusterer({
      map,
      markers,
    });

    return () => {
      designClustererRef.current?.clearMarkers();
      designMarkersRef.current.forEach((m) => (m.map = null));
      designMarkersRef.current = [];
    };
  }, [map, googleApi, showDesigns, getInfoWindow]);

  // ─── Heatmap layer ─────────────────────────────────────
  useEffect(() => {
    if (!map || !googleApi) return;

    // Remove existing heatmap
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    }

    if (!showHeatmap) return;

    const heatmapData = MOCK_HOTSPOTS.map((pin) => ({
      location: new googleApi.maps.LatLng(pin.lat, pin.lng),
      weight: pin.upvotes,
    }));

    heatmapRef.current =
      new googleApi.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map,
        radius: 40,
        opacity: 0.6,
      });

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [map, googleApi, showHeatmap]);

  // This is a behavior-only component, no visual output
  return null;
}
