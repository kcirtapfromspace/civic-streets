import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { HotspotPin } from '@/lib/types';
import { HOTSPOT_CATEGORY_COLORS } from '@/lib/types';
import {
  upvoteScale,
  createHotspotSvg,
  buildHotspotPopupElement,
  computePinBounds,
} from './pin-utils';

export interface ExplorerMinimapProps {
  hotspots: HotspotPin[];
  hoveredId?: string | null;
  selectedId?: string | null;
  onPinClick?: (id: string) => void;
  onPinHover?: (id: string | null) => void;
  onBoundsChange?: (bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 },
  ],
};

export function ExplorerMinimap({
  hotspots,
  hoveredId,
  selectedId,
  onPinClick,
  onPinHover,
  onBoundsChange,
}: ExplorerMinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const initialFitDoneRef = useRef(false);

  // Search state
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const getPopup = useCallback(() => {
    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '320px',
      });
    }
    return popupRef.current;
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-98.5, 39.8], // US center fallback
      zoom: 3,
      attributionControl: false,
      maxZoom: 19,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    mapRef.current = map;

    // Fire bounds on move
    map.on('moveend', () => {
      if (!onBoundsChange) return;
      const b = map.getBounds();
      onBoundsChange({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render / update hotspot markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Wait for map to load
    const renderMarkers = () => {
      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      hotspots.forEach((pin) => {
        const color = HOTSPOT_CATEGORY_COLORS[pin.category];
        const size = upvoteScale(pin.upvotes);
        const el = createHotspotSvg(color, size);

        // Hover events
        el.addEventListener('mouseenter', () => onPinHover?.(pin.id));
        el.addEventListener('mouseleave', () => onPinHover?.(null));

        // Click event
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onPinClick?.(pin.id);
          getPopup()
            .setLngLat([pin.lng, pin.lat])
            .setDOMContent(buildHotspotPopupElement(pin))
            .addTo(map);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);

        markersRef.current.set(pin.id, marker);
      });

      // Auto-fit bounds on first load
      if (!initialFitDoneRef.current && hotspots.length > 0) {
        const bounds = computePinBounds(hotspots);
        if (bounds) {
          map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
          initialFitDoneRef.current = true;
        }
      }
    };

    if (map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once('load', renderMarkers);
    }
  }, [hotspots, onPinClick, onPinHover, getPopup]);

  // Highlight hovered pin
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (id === hoveredId) {
        el.style.transform = `${el.style.transform.replace(/scale\([^)]*\)/, '')} scale(1.4)`;
        el.style.zIndex = '10';
        el.style.filter = 'drop-shadow(0 0 4px rgba(0,0,0,0.3))';
      } else {
        el.style.transform = el.style.transform.replace(/\s*scale\([^)]*\)/, '');
        el.style.zIndex = '';
        el.style.filter = '';
      }
    });
  }, [hoveredId]);

  // Highlight selected pin
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;
    const lngLat = marker.getLngLat();
    mapRef.current.flyTo({ center: lngLat, zoom: 15, duration: 800 });
  }, [selectedId]);

  // Nominatim search
  const searchNominatim = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (!res.ok) return;
      const results: NominatimResult[] = await res.json();
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      // Nominatim unavailable
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchText(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchNominatim(value), 350);
    },
    [searchNominatim],
  );

  const handleSelectSuggestion = useCallback(
    (result: NominatimResult) => {
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      setSearchText(result.display_name);
      setSuggestions([]);
      setShowSuggestions(false);

      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
    },
    [],
  );

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-minimap-search]')) {
        setShowSuggestions(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Search bar */}
      <div
        className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-1"
        data-minimap-search
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] flex items-center px-3 py-2 gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 text-gray-400 flex-shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search address..."
            className="flex-1 bg-transparent text-[12px] font-medium text-gray-900 placeholder-gray-300 outline-none min-w-0"
          />
          {searchText && (
            <button
              onClick={() => {
                setSearchText('');
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="bg-white/95 backdrop-blur-xl rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.04] py-1 max-h-48 overflow-y-auto">
            {suggestions.map((result) => (
              <button
                key={result.place_id}
                onClick={() => handleSelectSuggestion(result)}
                className="w-full text-left px-3 py-1.5 text-[11px] text-gray-600 hover:bg-blue-50/60 hover:text-gray-900 transition-colors truncate"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map container */}
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />
    </div>
  );
}

export default ExplorerMinimap;
