import React, { useRef, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui';
import {
  HOTSPOT_CATEGORY_LABELS,
  HOTSPOT_CATEGORY_COLORS,
  SEVERITY_LABELS,
} from '@/lib/types/community';
import type { HotspotCategory, HotspotSeverity, HotspotStatus } from '@/lib/types/community';
import { useCommunityStore } from './community-store';
import type { MockHotspot } from './mock-data';

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

// ── Individual Card ──────────────────────────────────────────────────────

interface HotspotCardItemProps {
  hotspot: MockHotspot;
  isHovered: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

const HotspotCardItem = React.forwardRef<HTMLButtonElement, HotspotCardItemProps>(
  function HotspotCardItem({ hotspot, isHovered, isSelected, onMouseEnter, onMouseLeave, onClick }, ref) {
    const categoryColor = HOTSPOT_CATEGORY_COLORS[hotspot.category];

    // Build dynamic class list
    let borderClass = 'border-gray-200';
    let bgClass = 'bg-white';
    let ringClass = '';

    if (isSelected) {
      ringClass = 'ring-2 ring-blue-500';
      borderClass = 'border-blue-300';
    } else if (isHovered) {
      bgClass = 'bg-blue-50';
      borderClass = 'border-blue-200';
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`w-full text-left rounded-lg border shadow-sm hover:shadow-md transition-all p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${bgClass} ${borderClass} ${ringClass}`}
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
  },
);

// ── Card List ────────────────────────────────────────────────────────────

interface HotspotCardListProps {
  hotspots: MockHotspot[];
  onSelectHotspot: (id: string) => void;
}

export function HotspotCardList({ hotspots, onSelectHotspot }: HotspotCardListProps) {
  const {
    hoveredHotspotId,
    selectedHotspotId,
    setHoveredHotspot,
  } = useCommunityStore();

  // Refs map for scroll-to-card
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When selectedHotspotId changes (from map pin click), scroll that card into view
  useEffect(() => {
    if (!selectedHotspotId) return;

    const el = cardRefs.current.get(selectedHotspotId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Clear the selection ring after 3 seconds
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = setTimeout(() => {
      useCommunityStore.getState().setSelectedHotspot(null);
    }, 3000);

    return () => {
      if (highlightTimer.current) {
        clearTimeout(highlightTimer.current);
      }
    };
  }, [selectedHotspotId]);

  const setCardRef = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) {
        cardRefs.current.set(id, el);
      } else {
        cardRefs.current.delete(id);
      }
    },
    [],
  );

  return (
    <div className="space-y-3">
      {hotspots.map((hotspot) => (
        <HotspotCardItem
          key={hotspot.id}
          ref={setCardRef(hotspot.id)}
          hotspot={hotspot}
          isHovered={hoveredHotspotId === hotspot.id}
          isSelected={selectedHotspotId === hotspot.id}
          onMouseEnter={() => setHoveredHotspot(hotspot.id)}
          onMouseLeave={() => setHoveredHotspot(null)}
          onClick={() => onSelectHotspot(hotspot.id)}
        />
      ))}
    </div>
  );
}
