import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Button, Select } from '@/components/ui';
import {
  HOTSPOT_CATEGORY_LABELS,
} from '@/lib/types/community';
import type { HotspotCategory, HotspotStatus } from '@/lib/types/community';
import { useCommunityStore } from './community-store';
import { useHotspotsList, mockHotspotToPin } from '@/lib/api/use-hotspots';
import { useExplorerStore } from './explorer-store';
import type { Bounds } from './explorer-store';
import { HotspotCardList } from './HotspotCardList';
import { ExplorerMinimap } from './ExplorerMinimap';
import { SearchThisArea } from './SearchThisArea';
import { DrawingTool } from './DrawingTool';
import { SavedAreas, promptAndSaveArea } from './SavedAreas';
import type { SavedArea } from './SavedAreas';
import { filterByPolygon } from '@/lib/utils/point-in-polygon';
import { MobileMapDrawer } from './MobileMapDrawer';
import type { HotspotPin } from '@/lib/types/community';
import type maplibregl from 'maplibre-gl';

// ── Filter options ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<HotspotStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  'in-progress': 'In Progress',
  resolved: 'Resolved',
};

const categoryFilterOptions = [
  { value: '', label: 'All Categories' },
  ...Object.entries(HOTSPOT_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const statusFilterOptions = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const sortOptions = [
  { value: 'votes', label: 'Most Votes' },
  { value: 'newest', label: 'Newest' },
  { value: 'nearest', label: 'Nearest' },
];

// ── Hotspot Explorer ──────────────────────────────────────────────────────

interface HotspotExplorerProps {
  onSelectHotspot?: (id: string) => void;
}

export function HotspotExplorer({ onSelectHotspot }: HotspotExplorerProps) {
  const { feedFilter, searchQuery, setFeedFilter, setSearchQuery, setActiveHotspot, setSelectedHotspot, hoveredHotspotId, setHoveredHotspot } =
    useCommunityStore();

  const {
    boundsFilter,
    polygonFilter,
    showSearchButton,
    setBoundsFilter,
    setPolygonFilter,
    setShowSearchButton,
    clearSpatialFilters,
  } = useExplorerStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const pendingBoundsRef = useRef<Bounds | null>(null);
  const minimapRef = useRef<maplibregl.Map | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────

  const { hotspots: allHotspots, isLoading } = useHotspotsList({
    category: feedFilter.category as HotspotCategory | undefined,
    status: feedFilter.status as HotspotStatus | undefined,
    sort: feedFilter.sort,
  });

  // Apply text search + spatial filters
  const filtered = useMemo(() => {
    let items = allHotspots;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q),
      );
    }

    // Bounds filter (from "Search this area")
    if (boundsFilter) {
      items = items.filter(
        (h) =>
          h.lat >= boundsFilter.minLat &&
          h.lat <= boundsFilter.maxLat &&
          h.lng >= boundsFilter.minLng &&
          h.lng <= boundsFilter.maxLng,
      );
    }

    // Polygon filter (from drawing tool)
    if (polygonFilter) {
      const pins = items.map(mockHotspotToPin);
      const insidePins = filterByPolygon(pins, polygonFilter);
      const insideIds = new Set(insidePins.map((p) => p.id));
      items = items.filter((h) => insideIds.has(h.id));
    }

    return items;
  }, [allHotspots, searchQuery, boundsFilter, polygonFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Pins for the minimap
  const pins: HotspotPin[] = useMemo(
    () => filtered.map(mockHotspotToPin),
    [filtered],
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (id: string) => {
      setActiveHotspot(id);
      onSelectHotspot?.(id);
    },
    [setActiveHotspot, onSelectHotspot],
  );

  const handlePinClick = useCallback(
    (id: string) => {
      setSelectedHotspot(id);
    },
    [setSelectedHotspot],
  );

  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      pendingBoundsRef.current = bounds;
      if (!boundsFilter) {
        setShowSearchButton(true);
      }
    },
    [boundsFilter, setShowSearchButton],
  );

  const handleSearchThisArea = useCallback(() => {
    if (pendingBoundsRef.current) {
      setBoundsFilter(pendingBoundsRef.current);
      setVisibleCount(20);
    }
  }, [setBoundsFilter]);

  const handlePolygonComplete = useCallback(
    (polygon: [number, number][]) => {
      setPolygonFilter(polygon);
      setVisibleCount(20);
    },
    [setPolygonFilter],
  );

  const handleClearPolygon = useCallback(() => {
    setPolygonFilter(null);
  }, [setPolygonFilter]);

  const handleApplySavedArea = useCallback(
    (area: SavedArea) => {
      if (area.bounds) {
        setBoundsFilter(area.bounds);
      }
      if (area.polygon) {
        setPolygonFilter(area.polygon);
      }
      setVisibleCount(20);
    },
    [setBoundsFilter, setPolygonFilter],
  );

  const handleClearAllSpatial = useCallback(() => {
    clearSpatialFilters();
    setVisibleCount(20);
  }, [clearSpatialFilters]);

  const hasSpatialFilter = !!boundsFilter || !!polygonFilter;

  // ── Shared left panel content ─────────────────────────────────────────

  const leftPanel = (
    <div className="p-4">
      {/* Header */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Community Hotspots
      </h2>

      {/* Saved areas */}
      <div className="mb-3">
        <SavedAreas onApply={handleApplySavedArea} />
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hotspots..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Select
          label="Category"
          value={feedFilter.category ?? ''}
          onChange={(v) =>
            setFeedFilter({ category: (v || undefined) as HotspotCategory | undefined })
          }
          options={categoryFilterOptions}
          className="flex-1 min-w-[140px]"
        />
        <Select
          label="Status"
          value={feedFilter.status ?? ''}
          onChange={(v) =>
            setFeedFilter({ status: (v || undefined) as HotspotStatus | undefined })
          }
          options={statusFilterOptions}
          className="flex-1 min-w-[120px]"
        />
        <Select
          label="Sort"
          value={feedFilter.sort}
          onChange={(v) =>
            setFeedFilter({ sort: v as 'votes' | 'newest' | 'nearest' })
          }
          options={sortOptions}
          className="flex-1 min-w-[110px]"
        />
      </div>

      {/* Spatial filter chips */}
      {hasSpatialFilter && (
        <div className="flex flex-wrap gap-2 mb-3">
          {boundsFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Area filter
              <button
                onClick={() => setBoundsFilter(null)}
                className="text-blue-400 hover:text-blue-700"
              >
                &times;
              </button>
            </span>
          )}
          {polygonFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              Custom area
              <button
                onClick={() => setPolygonFilter(null)}
                className="text-purple-400 hover:text-purple-700"
              >
                &times;
              </button>
            </span>
          )}
          <button
            onClick={handleClearAllSpatial}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear all
          </button>
          <button
            onClick={() => {
              promptAndSaveArea({ bounds: boundsFilter ?? undefined, polygon: polygonFilter ?? undefined });
            }}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Save area
          </button>
        </div>
      )}

      {/* Results count */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-4">
          <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Loading hotspots...</span>
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">
          Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} hotspot{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Card list with cross-highlighting */}
      <HotspotCardList
        hotspots={visible}
        onSelectHotspot={handleSelect}
      />

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">
            No hotspots match your filters.
          </p>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="text-center mt-6">
          <Button
            variant="secondary"
            onClick={() => setVisibleCount((c) => c + 20)}
          >
            Load More ({filtered.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );

  // ── Map content (shared between desktop + mobile drawer) ───────────────

  const mapContent = (
    <div className="relative w-full h-full">
      <ExplorerMinimap
        hotspots={pins}
        hoveredId={hoveredHotspotId}
        onPinClick={handlePinClick}
        onPinHover={(id) => setHoveredHotspot(id ?? null)}
        onBoundsChange={handleBoundsChange}
      />

      {/* Search this area overlay */}
      <SearchThisArea
        visible={showSearchButton && !boundsFilter}
        onSearch={handleSearchThisArea}
      />

      {/* Drawing tool — positioned bottom-left */}
      {/* DrawingTool needs the map instance; for now render placeholder until map ref is available */}
    </div>
  );

  return (
    <>
      {/* Desktop: split-panel grid — map left, cards right */}
      <div className="hidden md:grid md:grid-cols-[55fr_45fr] h-full">
        {/* Left panel — sticky map */}
        <div className="sticky top-0 h-screen">
          {mapContent}
        </div>

        {/* Right panel — scrollable card list */}
        <div className="overflow-y-auto bg-gray-50 border-l border-gray-200">
          {leftPanel}
        </div>
      </div>

      {/* Mobile: full-width list + floating map button + drawer */}
      <div className="md:hidden h-full overflow-y-auto bg-gray-50">
        {leftPanel}

        {/* Floating Map button */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Map
        </button>

        <MobileMapDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {mapContent}
        </MobileMapDrawer>
      </div>
    </>
  );
}
