import { useState, useEffect, useRef, useCallback, useId, type KeyboardEvent } from 'react';
import type maplibregl from 'maplibre-gl';
import { useMapStore } from './map-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProposalStore } from '@/stores/proposal-store';
import { fetchRoadPath } from '@/features/proposal/utils/road-geometry';
import { useStartProposal } from '@/features/proposal/useStartProposal';
import { useSafetyDataStore } from '@/features/safety-data/safety-data-store';
import { CrashCoverageStatus } from '@/features/safety-data/CrashCoverageStatus';
import { useSubmittedPlaceSearch } from '@/lib/api/use-submitted-place-search';
import type { GeocodingResult } from '@/lib/api/geocoding';
import {
  MODE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  type CrashMode,
  type CrashSeverity,
} from '@/lib/types/safety-data';

const ALL_MODES: CrashMode[] = ['pedestrian', 'cyclist', 'motorist'];
const ALL_SEVERITIES: CrashSeverity[] = [
  'fatal',
  'severe-injury',
  'moderate-injury',
  'minor',
  'unknown',
];
const MODE_COLORS: Record<CrashMode, string> = {
  pedestrian: '#8B5CF6',
  cyclist: '#10B981',
  motorist: '#3B82F6',
};
const PANEL = 'rounded-lg border border-[#d8dddf] bg-white text-[#172126]';
const CONTROL =
  'min-h-11 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172126]';
const CHECKBOX = 'h-4 w-4 shrink-0 rounded border-[#d8dddf] accent-[#172126]';
const CHECK_LABEL = 'flex min-h-11 cursor-pointer items-center gap-2.5 text-xs';

interface MapControlsProps {
  map: maplibregl.Map | null;
}

export function MapControls({ map }: MapControlsProps) {
  const {
    showHotspots,
    showDesigns,
    showHeatmap,
    showServiceAreas,
    is3D,
    mapType,
    selectedLocation,
    center,
    zoom,
    initialLocationStatus,
    initialLocationLabel,
    toggleHotspots,
    toggleDesigns,
    toggleHeatmap,
    toggleServiceAreas,
    toggle3D,
    setMapType,
    setCenter,
    setZoom,
    setSelectedLocation,
    openReportForm,
  } = useMapStore();
  const workspaceMode = useWorkspaceStore((s) => s.mode);
  const { startProposal, confirmation } = useStartProposal();
  const crashEnabled = useSafetyDataStore((s) => s.enabled);
  const crashFilters = useSafetyDataStore((s) => s.filters);
  const showCrashHeatmap = useSafetyDataStore((s) => s.showHeatmap);
  const showCrashPoints = useSafetyDataStore((s) => s.showPoints);
  const toggleCrashMode = useSafetyDataStore((s) => s.toggleMode);
  const toggleCrashSeverity = useSafetyDataStore((s) => s.toggleSeverity);
  const toggleCrashHeatmap = useSafetyDataStore((s) => s.toggleHeatmap);
  const toggleCrashPoints = useSafetyDataStore((s) => s.togglePoints);

  const {
    query: searchText,
    setQuery: handleSearchChange,
    results: suggestions,
    isLoading: searchLoading,
    error: searchError,
    hasSearched: searchHasSearched,
    search: submitSearch,
  } = useSubmittedPlaceSearch();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const resultsId = useId();
  const optionsId = useId();
  const layersId = useId();
  const guidanceId = useId();

  const handleSelectSuggestion = useCallback(
    (result: GeocodingResult) => {
      const lat = Number(result.lat);
      const lng = Number(result.lon);
      const address = result.display_name;
      setCenter({ lat, lng });
      setZoom(17);
      setSelectedLocation({ lat, lng, address });
      handleSearchChange(address);
      searchInputRef.current?.focus();
      setShowSuggestions(false);
    },
    [setCenter, setZoom, setSelectedLocation, handleSearchChange],
  );

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-search-container]')) setShowSuggestions(false);
      if (!target.closest('[data-map-options]')) setIsOptionsOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleSearchKey = (event: KeyboardEvent, index = -1) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      searchInputRef.current?.focus();
      setShowSuggestions(false);
      return;
    }
    if (suggestions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setShowSuggestions(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const next =
        index < 0
          ? direction > 0
            ? 0
            : suggestions.length - 1
          : (index + direction + suggestions.length) % suggestions.length;
      // Results may have been closed; focus after React mounts the list.
      requestAnimationFrame(() => resultRefs.current[next]?.focus());
    }
  };

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
  const locationHint =
    initialLocationStatus === 'located'
      ? `Near ${initialLocationLabel ?? 'your area'} · approximate IP location`
      : initialLocationStatus === 'fallback'
        ? 'Starting in Denver. Search for your street.'
        : initialLocationStatus === 'skipped'
          ? null
          : 'Finding your area…';

  return (
    <>
      {workspaceMode === 'explore' && (
        <section
          aria-label="Find a street"
          className="absolute left-3 right-3 top-3 z-10 max-w-[420px] sm:left-4 sm:right-auto sm:top-4 sm:w-[420px]"
          data-search-container
        >
          <div className={`${PANEL} p-3 sm:p-4`}>
            <label htmlFor={`${resultsId}-input`} className="block text-sm font-semibold">
              Find your street
            </label>
            <p id={guidanceId} className="mt-1 text-xs leading-5 text-[#59646a]">
              Search an address or click a block to mark a problem.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setShowSuggestions(true);
                void submitSearch();
              }}
              className="mt-3 flex min-h-12 items-center rounded-md border border-[#d8dddf] bg-white focus-within:border-[#172126] focus-within:ring-1 focus-within:ring-[#172126]"
            >
              <input
                id={`${resultsId}-input`}
                ref={searchInputRef}
                aria-label="Search places"
                aria-describedby={guidanceId}
                aria-controls={showSuggestions ? resultsId : undefined}
                type="text"
                autoComplete="off"
                value={searchText}
                onChange={(event) => handleSearchChange(event.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={(event) => handleSearchKey(event)}
                placeholder="Address or intersection"
                className="min-h-11 min-w-0 flex-1 rounded-md bg-transparent px-3 text-base text-[#172126] outline-none placeholder:text-[#59646a] sm:text-sm"
              />
              {searchText && (
                <button
                  type="button"
                  aria-label="Clear place search"
                  onClick={() => {
                    handleSearchChange('');
                    setSelectedLocation(null);
                    setShowSuggestions(false);
                    searchInputRef.current?.focus();
                  }}
                  className={`${CONTROL} min-w-11 text-lg hover:bg-[#f3f5f5]`}
                >
                  ×
                </button>
              )}
              <button
                type="submit"
                disabled={searchLoading || searchText.trim().length < 3}
                className={`${CONTROL} m-1 bg-[#172126] text-white hover:bg-[#303d43] disabled:cursor-not-allowed disabled:opacity-45`}
              >
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </form>
            {!selectedLocation && locationHint && (
              <p className="mt-2 text-[11px] leading-4 text-[#59646a]" aria-live="polite">
                {locationHint}
              </p>
            )}
            {!selectedLocation && initialLocationStatus !== 'skipped' && (
              <p className="mt-1 text-[10px] leading-4 text-[#59646a]">
                IP estimate by GeoJS.{' '}
                <a
                  href="https://www.geojs.io/docs/v1/endpoints/geo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#172126]"
                >
                  How it works
                </a>
                {' · '}
                <a
                  href="https://www.geojs.io/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#172126]"
                >
                  Privacy
                </a>
              </p>
            )}
          </div>

          {searchError && (
            <p role="alert" className={`${PANEL} mt-2 p-3 text-xs text-red-800`}>
              {searchError}
            </p>
          )}
          {searchHasSearched && !searchLoading && !searchError && !suggestions.length && (
            <p role="status" className={`${PANEL} mt-2 p-3 text-xs`}>
              No places matched this search. Try a nearby street or choose a location on the map.
            </p>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className={`${PANEL} mt-2 max-h-[35dvh] overflow-y-auto overscroll-contain p-1`}>
              <ul id={resultsId} aria-label="Search results">
                {suggestions.map((result, index) => (
                  <li key={result.place_id}>
                    <button
                      type="button"
                      ref={(element) => {
                        resultRefs.current[index] = element;
                      }}
                      onClick={() => handleSelectSuggestion(result)}
                      onKeyDown={(event) => handleSearchKey(event, index)}
                      className="min-h-11 w-full rounded-md px-3 py-2 text-left text-sm leading-5 hover:bg-[#f3f5f5] focus-visible:bg-[#f3f5f5] focus-visible:outline-2 focus-visible:outline-[#172126]"
                    >
                      {result.display_name}
                    </button>
                  </li>
                ))}
              </ul>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center px-3 text-[10px] text-[#59646a] underline"
              >
                Search data © OpenStreetMap contributors
              </a>
            </div>
          )}

          {selectedLocation && !showSuggestions && (
            <div className={`${PANEL} mt-2 p-3 sm:p-4`}>
              <p className="text-[10px] font-semibold  text-[#172126]">Location selected</p>
              <p className="mt-1 truncate text-sm font-semibold" title={selectedLocation.address}>
                {selectedLocation.address}
              </p>
              {workspaceMode === 'explore' && (
                <>
                  <p className="mt-1 text-xs text-[#59646a]">Describe the problem at this spot.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openReportForm(selectedLocation)}
                      className={`${CONTROL} bg-[#172126] text-white hover:bg-[#303d43] disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      Mark a problem
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const location = { ...selectedLocation };
                        const streetName =
                          location.address ===
                          `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                            ? 'Selected street'
                            : location.address.split(',')[0].trim();
                        startProposal({ streetName, location, onStarted: async () => {
                          const { proposalId, setRoadPath } = useProposalStore.getState();
                          try {
                            const { path, bearing } = await fetchRoadPath({
                              lat: location.lat,
                              lng: location.lng,
                            });
                            if (
                              useProposalStore.getState().proposalId === proposalId &&
                              useWorkspaceStore.getState().mode === 'propose'
                            ) {
                              setRoadPath(path, bearing);
                            }
                          } catch {
                            /* Road geometry is optional. */
                          }
                        } });
                      }}
                      className={`${CONTROL} border border-[#d8dddf] hover:bg-[#f3f5f5]`}
                    >
                      Sketch a change
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {workspaceMode !== 'propose' && <div
        className="absolute bottom-4 right-16 z-30 flex flex-col items-end gap-2"
        data-map-options
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setIsOptionsOpen(false);
            optionsButtonRef.current?.focus();
          }
        }}
      >
        {isOptionsOpen && (
          <section
            id={optionsId}
            aria-label="Map options"
            className={`${PANEL} max-h-[45dvh] w-[min(320px,calc(100vw-88px))] overflow-y-auto overscroll-contain p-3`}
          >
            <p className="mb-2 text-[10px] font-semibold  text-[#59646a]">Map view</p>
            <div className="flex gap-1">
              {(['roadmap', 'satellite', 'earth'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => handleViewModeChange(mode)}
                  aria-pressed={currentViewMode === mode}
                  className={`${CONTROL} flex-1 ${currentViewMode === mode ? 'bg-[#172126] text-white' : 'hover:bg-[#f3f5f5]'}`}
                >
                  {{ roadmap: 'Map', satellite: 'Satellite', earth: 'Earth' }[mode]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
              aria-expanded={isLayersPanelOpen}
              aria-controls={layersId}
              className={`${CONTROL} mt-3 flex w-full items-center justify-between border-t border-[#d8dddf] text-left hover:bg-[#f3f5f5]`}
            >
              Layers <span aria-hidden="true">{isLayersPanelOpen ? '−' : '+'}</span>
            </button>
            {isLayersPanelOpen && (
              <div id={layersId}>
                <label className={CHECK_LABEL}>
                  <input
                    type="checkbox"
                    checked={showHotspots}
                    onChange={toggleHotspots}
                    className={CHECKBOX}
                  />
                  Community Hotspots
                </label>
                <label className={CHECK_LABEL}>
                  <input
                    type="checkbox"
                    checked={showDesigns}
                    onChange={toggleDesigns}
                    className={CHECKBOX}
                  />
                  Community Designs
                </label>
                <label className={CHECK_LABEL}>
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={toggleHeatmap}
                    className={CHECKBOX}
                  />
                  Heatmap
                </label>
                <label className={CHECK_LABEL}>
                  <input
                    type="checkbox"
                    checked={showServiceAreas}
                    onChange={toggleServiceAreas}
                    className={CHECKBOX}
                  />
                  Service Areas
                </label>
                <p className="mt-2 border-t border-[#d8dddf] pt-3 text-[10px] font-semibold  text-[#59646a]">
                  Safety data
                </p>
                <label className={CHECK_LABEL}>
                  <input
                    type="checkbox"
                    checked={crashEnabled}
                    onChange={() => useSafetyDataStore.getState().setEnabled(!crashEnabled)}
                    className={CHECKBOX}
                  />
                  Crash Heatmap
                </label>
                {crashEnabled && (
                  <div className="pl-2">
                    <CrashCoverageStatus zoom={zoom} />
                    <label className={CHECK_LABEL}>
                      <input
                        type="checkbox"
                        checked={showCrashHeatmap}
                        onChange={toggleCrashHeatmap}
                        className={CHECKBOX}
                      />
                      Heatmap
                    </label>
                    <label className={CHECK_LABEL}>
                      <input
                        type="checkbox"
                        checked={showCrashPoints}
                        onChange={toggleCrashPoints}
                        className={CHECKBOX}
                      />
                      Points
                    </label>
                    <p className="mt-2 text-[10px] font-semibold  text-[#59646a]">Mode</p>
                    {ALL_MODES.map((mode) => (
                      <label key={mode} className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={crashFilters.modes.has(mode)}
                          onChange={() => toggleCrashMode(mode)}
                          className={CHECKBOX}
                          style={{ accentColor: MODE_COLORS[mode] }}
                        />
                        {MODE_LABELS[mode]}
                      </label>
                    ))}
                    <p className="mt-2 text-[10px] font-semibold  text-[#59646a]">Severity</p>
                    {ALL_SEVERITIES.map((severity) => (
                      <label key={severity} className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={crashFilters.severities.has(severity)}
                          onChange={() => toggleCrashSeverity(severity)}
                          className={CHECKBOX}
                          style={{ accentColor: SEVERITY_COLORS[severity] }}
                        />
                        {SEVERITY_LABELS[severity]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {map && (
              <p className="mt-2 border-t border-[#d8dddf] pt-3 font-mono text-[10px] text-[#59646a]">
                {center.lat.toFixed(4)}, {center.lng.toFixed(4)} · zoom {zoom.toFixed(0)}
              </p>
            )}
          </section>
        )}
        <button
          ref={optionsButtonRef}
          type="button"
          aria-expanded={isOptionsOpen}
          aria-controls={optionsId}
          onClick={() => setIsOptionsOpen(!isOptionsOpen)}
          className={`${PANEL} ${CONTROL} min-w-28 hover:bg-[#f3f5f5]`}
        >
          Map options
        </button>
      </div>}
      {confirmation}
    </>
  );
}
