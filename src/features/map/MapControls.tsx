import { useState, useEffect, useRef, useCallback } from 'react';
import type maplibregl from 'maplibre-gl';
import { useMapStore } from './map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProposalStore } from '@/stores/proposal-store';
import { fetchRoadPath } from '@/features/proposal/utils/road-geometry';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { CrashFilterPanel } from '@/features/safety-data/CrashFilterPanel';

interface MapControlsProps {
  map: maplibregl.Map | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export function MapControls({ map }: MapControlsProps) {
  const {
    showHotspots,
    showDesigns,
    showHeatmap,
    is3D,
    mapType,
    selectedLocation,
    toggleHotspots,
    toggleDesigns,
    toggleHeatmap,
    toggle3D,
    setMapType,
    setCenter,
    setZoom,
    setSelectedLocation,
  } = useMapStore();

  // Reactive subscription to crash data enabled state (fixes non-reactive getState() bug)
  const crashEnabled = useSafetyDataStore((s) => s.enabled);

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Nominatim search with debounce
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
      const address = result.display_name;

      setCenter({ lat, lng });
      setZoom(17);
      setSelectedLocation({ lat, lng, address });
      setSearchText(address);
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [setCenter, setZoom, setSelectedLocation],
  );

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-search-container]')) {
        setShowSuggestions(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleViewModeChange = useCallback(
    (mode: 'roadmap' | 'satellite' | 'earth') => {
      if (mode === 'earth') {
        if (!is3D) toggle3D();
      } else {
        if (is3D) toggle3D();
        setMapType(mode);
      }
    },
    [is3D, toggle3D, setMapType],
  );

  const currentViewMode = is3D
    ? 'earth'
    : mapType === 'satellite' || mapType === 'hybrid'
      ? 'satellite'
      : 'roadmap';

  return (
    <>
      {/* Search bar */}
      <div
        className="absolute top-4 left-4 z-10 flex flex-col gap-2"
        style={{ maxWidth: '400px', width: 'calc(100% - 32px)' }}
        data-search-container
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] flex items-center px-4 py-2.5 gap-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 text-gray-400 flex-shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>

          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search address or place..."
            className="flex-1 bg-transparent text-[13px] font-medium text-gray-900 placeholder-gray-300 outline-none"
          />

          {searchText && (
            <button
              onClick={() => {
                setSearchText('');
                setSelectedLocation(null);
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] py-1.5 max-h-60 overflow-y-auto animate-fade-up">
            {suggestions.map((result) => (
              <button
                key={result.place_id}
                onClick={() => handleSelectSuggestion(result)}
                className="w-full text-left px-4 py-2 text-[13px] text-gray-600 hover:bg-blue-50/60 hover:text-gray-900 transition-all duration-200 ease-spring truncate"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}

        {/* Selected location info bar */}
        {selectedLocation && (
          <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] px-4 py-2.5 flex flex-col gap-2.5 animate-fade-up">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-blue-500 flex-shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs text-gray-700 truncate">
                {selectedLocation.address}
              </span>
            </div>

            {/* Propose a Change button */}
            {useWorkspaceStore.getState().mode === 'explore' && (
              <button
                onClick={async () => {
                  const location = {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng,
                    address: selectedLocation.address,
                  };
                  const initProposal = useProposalStore.getState().initProposal;
                  const setRoadPath = useProposalStore.getState().setRoadPath;
                  const enterProposeMode = useWorkspaceStore.getState().enterProposeMode;

                  const streetName = selectedLocation.address.split(',')[0].trim();

                  initProposal(streetName, location);
                  enterProposeMode(location);

                  // Fetch road geometry in background (no API key needed)
                  try {
                    const { path, bearing } = await fetchRoadPath(
                      { lat: selectedLocation.lat, lng: selectedLocation.lng },
                    );
                    setRoadPath(path, bearing);
                  } catch {
                    // Road geometry is optional
                  }
                }}
                className="flex items-center gap-2 text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full transition-all duration-300 ease-spring active:scale-[0.98] shadow-[0_1px_3px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                </svg>
                Propose a Change
              </button>
            )}
          </div>
        )}
      </div>

      {/* Control buttons — right side */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {/* View mode toggle */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] p-1.5 flex flex-col gap-0.5">
          {(['roadmap', 'satellite', 'earth'] as const).map((mode) => {
            const labels = {
              roadmap: 'Map',
              satellite: 'Satellite',
              earth: 'Earth',
            };
            const icons = {
              roadmap: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.157 2.175a1.5 1.5 0 00-1.147 0l-4.084 1.69A1.5 1.5 0 002 5.251v10.877a1.5 1.5 0 002.074 1.386l3.51-1.453 4.26 1.763a1.5 1.5 0 001.146 0l4.084-1.69A1.5 1.5 0 0018 14.748V3.873a1.5 1.5 0 00-2.074-1.386l-3.51 1.453-4.26-1.765zM7.58 5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 017.58 5zm5.59 2.75a.75.75 0 00-1.5 0v6.5a.75.75 0 001.5 0v-6.5z" clipRule="evenodd" />
                </svg>
              ),
              satellite: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h4.59l-2.1 1.95a.75.75 0 001.02 1.1l3.5-3.25a.75.75 0 000-1.1l-3.5-3.25a.75.75 0 10-1.02 1.1l2.1 1.95H6.75z" />
                </svg>
              ),
              earth: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-1.503.204A6.5 6.5 0 117.95 3.83L6.927 5.62a1.453 1.453 0 001.91 2.02l.175-.087a.75.75 0 011.088.478l.14.701a.75.75 0 01-.46.849l-.39.156a.75.75 0 00-.326 1.148l.556.741a.75.75 0 01-.094 1.004l-.396.363a.75.75 0 00-.21.727l.19.76a.75.75 0 01-.2.722l-.264.264a.75.75 0 00-.12.884l.383.67z" clipRule="evenodd" />
                </svg>
              ),
            };

            return (
              <button
                key={mode}
                onClick={() => handleViewModeChange(mode)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-300 ease-spring ${
                  currentViewMode === mode
                    ? 'bg-blue-600 text-white shadow-[0_1px_3px_rgba(37,99,235,0.3)]'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                {icons[mode]}
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Layers toggle button */}
        <button
          onClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
          className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] p-2.5 flex items-center gap-2 text-[12px] font-semibold transition-all duration-300 ease-spring ${
            isLayersPanelOpen
              ? 'text-blue-600 bg-blue-50/80'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M1 12.5A4.5 4.5 0 005.5 17H15a4 4 0 001.866-7.539 3.504 3.504 0 00-4.504-4.272A4.5 4.5 0 004.06 8.235 4.502 4.502 0 001 12.5z" />
          </svg>
          Layers
        </button>

        {/* Layers panel */}
        {isLayersPanelOpen && (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] p-3.5 flex flex-col gap-3 min-w-[180px] animate-fade-up">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em]">
              Map Layers
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={toggleHotspots}
                className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-xs text-gray-700 group-hover:text-gray-900">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: '#DC2626' }}
                />
                Community Hotspots
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={showDesigns}
                onChange={toggleDesigns}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-xs text-gray-700 group-hover:text-gray-900">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: '#2563EB' }}
                />
                Community Designs
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={toggleHeatmap}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-xs text-gray-700 group-hover:text-gray-900">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, #FF6B00, #FF6B0040)',
                  }}
                />
                Heatmap
              </span>
            </label>

            <div className="border-t border-gray-100 pt-2 mt-1">
              <div className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em] mb-2">
                Safety Data
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={crashEnabled}
                onChange={() => {
                  useSafetyDataStore.getState().setEnabled(!crashEnabled);
                }}
                className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-xs text-gray-700 group-hover:text-gray-900">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, #DC2626, #DC262640)',
                  }}
                />
                Crash Heatmap
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Map attribution / zoom level indicator */}
      {map && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded font-mono">
            {useMapStore.getState().center.lat.toFixed(4)},{' '}
            {useMapStore.getState().center.lng.toFixed(4)} | z
            {useMapStore.getState().zoom.toFixed(0)}
          </div>
        </div>
      )}

      <CrashFilterPanel />
    </>
  );
}
