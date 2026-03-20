import React, { useState, useMemo, useCallback } from 'react';
import { Badge, Button, Select } from '@/components/ui';
import {
  HOTSPOT_CATEGORY_LABELS,
  HOTSPOT_CATEGORY_COLORS,
  SEVERITY_LABELS,
} from '@/lib/types/community';
import type { HotspotCategory, HotspotStatus, HotspotSeverity } from '@/lib/types/community';
import { useCommunityStore } from './community-store';
import type { MockHotspot } from './mock-data';
import { MOCK_HOTSPOTS } from './mock-data';
import { useLocalHotspotsStore } from '@/stores/local-hotspots-store';

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const SEVERITY_VARIANTS: Record<HotspotSeverity, 'default' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const STATUS_VARIANTS: Record<HotspotStatus, 'default' | 'info' | 'warning' | 'success'> = {
  open: 'default',
  acknowledged: 'info',
  'in-progress': 'warning',
  resolved: 'success',
};

const STATUS_LABELS: Record<HotspotStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  'in-progress': 'In Progress',
  resolved: 'Resolved',
};

// ── Filter options ────────────────────────────────────────────────────────

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

// ── Hotspot Card ──────────────────────────────────────────────────────────

interface HotspotCardProps {
  hotspot: MockHotspot;
  onClick: (id: string) => void;
}

function HotspotCard({ hotspot, onClick }: HotspotCardProps) {
  const categoryColor = HOTSPOT_CATEGORY_COLORS[hotspot.category];

  return (
    <button
      type="button"
      onClick={() => onClick(hotspot.id)}
      className="w-full text-left bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex items-start gap-3">
        {/* Category dot + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: categoryColor }}
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {hotspot.title}
            </h3>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <Badge variant={SEVERITY_VARIANTS[hotspot.severity]}>
              {SEVERITY_LABELS[hotspot.severity]}
            </Badge>
            <Badge variant={STATUS_VARIANTS[hotspot.status]}>
              {STATUS_LABELS[hotspot.status]}
            </Badge>
          </div>

          {/* Address */}
          <p className="text-xs text-gray-500 truncate">{hotspot.address}</p>
        </div>

        {/* Stats */}
        <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span className="tabular-nums font-medium text-gray-600">
              {hotspot.upvotes - hotspot.downvotes}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span className="tabular-nums">{hotspot.commentCount}</span>
          </div>
          <span className="text-[11px]">{timeAgo(hotspot.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

// ── Hotspot Feed ──────────────────────────────────────────────────────────

interface HotspotFeedProps {
  onSelectHotspot?: (id: string) => void;
  onCreateReport?: () => void;
}

export function HotspotFeed({
  onSelectHotspot,
  onCreateReport,
}: HotspotFeedProps) {
  const { feedFilter, searchQuery, setFeedFilter, setSearchQuery, setActiveHotspot } =
    useCommunityStore();

  const [visibleCount, setVisibleCount] = useState(10);

  const localHotspots = useLocalHotspotsStore((s) => s.hotspots);

  // Filter + sort
  const filtered = useMemo(() => {
    let items = [...localHotspots, ...MOCK_HOTSPOTS];

    // Category filter
    if (feedFilter.category) {
      items = items.filter((h) => h.category === feedFilter.category);
    }

    // Status filter
    if (feedFilter.status) {
      items = items.filter((h) => h.status === feedFilter.status);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q),
      );
    }

    // Sort
    switch (feedFilter.sort) {
      case 'votes':
        items.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes));
        break;
      case 'newest':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'nearest':
        // Without real geolocation, fall back to newest
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    return items;
  }, [feedFilter, searchQuery, localHotspots]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleSelect = useCallback(
    (id: string) => {
      setActiveHotspot(id);
      onSelectHotspot?.(id);
    },
    [setActiveHotspot, onSelectHotspot],
  );

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Community Hotspots
          </h2>
          {onCreateReport && (
            <Button variant="primary" onClick={onCreateReport}>
              + Report Issue
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
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
        <div className="flex flex-wrap gap-2 mb-4">
          <Select
            label="Category"
            value={feedFilter.category ?? ''}
            onChange={(v) =>
              setFeedFilter({
                category: (v || undefined) as HotspotCategory | undefined,
              })
            }
            options={categoryFilterOptions}
            className="flex-1 min-w-[140px]"
          />
          <Select
            label="Status"
            value={feedFilter.status ?? ''}
            onChange={(v) =>
              setFeedFilter({
                status: (v || undefined) as HotspotStatus | undefined,
              })
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

        {/* Results count */}
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length} hotspot{filtered.length !== 1 ? 's' : ''} found
        </p>

        {/* Card list */}
        <div className="space-y-3">
          {visible.map((hotspot) => (
            <HotspotCard
              key={hotspot.id}
              hotspot={hotspot}
              onClick={handleSelect}
            />
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
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
              onClick={() => setVisibleCount((c) => c + 10)}
            >
              Load More ({filtered.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
