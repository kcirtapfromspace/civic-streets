import maplibregl from 'maplibre-gl';
import type { HotspotPin } from '@/lib/types';
import {
  HOTSPOT_CATEGORY_COLORS,
  HOTSPOT_CATEGORY_LABELS,
  SEVERITY_LABELS,
} from '@/lib/types';

/** Scale marker size based on upvote count. */
export function upvoteScale(upvotes: number): number {
  if (upvotes >= 150) return 18;
  if (upvotes >= 75) return 14;
  if (upvotes >= 30) return 11;
  return 9;
}

/** Create a colored circle SVG element for hotspot markers using DOM API. */
export function createHotspotSvg(color: string, size: number): HTMLDivElement {
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

/** Build popup DOM element for a hotspot pin. */
export function buildHotspotPopupElement(pin: HotspotPin): HTMLDivElement {
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

/** Compute the bounding box that contains all hotspot pins. */
export function computePinBounds(pins: HotspotPin[]): maplibregl.LngLatBoundsLike | null {
  if (pins.length === 0) return null;
  const lngs = pins.map((p) => p.lng);
  const lats = pins.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
