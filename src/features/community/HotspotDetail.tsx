import React, { useState, useCallback } from 'react';
import { Badge, Button } from '@/components/ui';
import {
  HOTSPOT_CATEGORY_LABELS,
  HOTSPOT_CATEGORY_COLORS,
  SEVERITY_LABELS,
} from '@/lib/types/community';
import type { HotspotStatus } from '@/lib/types/community';
import { VoteButton } from './VoteButton';
import { CommentThread } from './CommentThread';
import { DesignCard } from './DesignCard';
import type { MockHotspot } from './mock-data';
import { MOCK_COMMENTS, MOCK_DESIGNS, MOCK_USERS } from './mock-data';
import type { MockUser } from './mock-data';
import { detectCivicService, submitCivicReport } from '@/lib/api/civic-report';

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

function getUserName(authorId: string): string {
  return (
    MOCK_USERS.find((u: MockUser) => u.id === authorId)?.displayName ??
    'Anonymous'
  );
}

const SEVERITY_VARIANTS: Record<string, 'default' | 'warning' | 'error'> = {
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

const STATUS_STEPS: HotspotStatus[] = ['open', 'acknowledged', 'in-progress', 'resolved'];

// ── Status Timeline ───────────────────────────────────────────────────────

function StatusTimeline({ currentStatus }: { currentStatus: HotspotStatus }) {
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1" aria-label={`Status: ${STATUS_LABELS[currentStatus]}`}>
      {STATUS_STEPS.map((step, i) => {
        const isReached = i <= currentIndex;
        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <div
                className={`flex-1 h-0.5 ${
                  isReached ? 'bg-blue-500' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isReached
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-300'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] leading-none ${
                  isReached ? 'text-blue-600 font-medium' : 'text-gray-400'
                }`}
              >
                {STATUS_LABELS[step]}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Photo Gallery ─────────────────────────────────────────────────────────

function PhotoGallery({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {urls.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`Photo ${i + 1}`}
          className="w-32 h-24 object-cover rounded-lg border border-gray-200 shrink-0"
        />
      ))}
    </div>
  );
}

// ── Hotspot Detail ────────────────────────────────────────────────────────

interface HotspotDetailProps {
  hotspot: MockHotspot;
  onBack?: () => void;
  onDesignFix?: (hotspotId: string) => void;
  onSendToRep?: (hotspotId: string) => void;
  onViewOnMap?: (lat: number, lng: number) => void;
}

export function HotspotDetail({
  hotspot,
  onBack,
  onDesignFix,
  onSendToRep,
  onViewOnMap,
}: HotspotDetailProps) {
  const categoryColor = HOTSPOT_CATEGORY_COLORS[hotspot.category];
  const comments = MOCK_COMMENTS.filter((c) => c.hotspotId === hotspot.id);
  const linkedDesigns = MOCK_DESIGNS.filter((d) =>
    hotspot.linkedDesignIds.includes(d.id),
  );

  // Civic reporting state
  const civicService = detectCivicService(hotspot.lat, hotspot.lng);
  const [civicStatus, setCivicStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [civicResult, setCivicResult] = useState<{ trackingId?: string; trackingUrl?: string; deepLinkUrl?: string } | null>(null);
  const [civicError, setCivicError] = useState<string | null>(null);

  const handleReportToCity = useCallback(async () => {
    setCivicStatus('submitting');
    setCivicError(null);

    const result = await submitCivicReport({
      lat: hotspot.lat,
      lng: hotspot.lng,
      address: hotspot.address,
      category: hotspot.category,
      title: hotspot.title,
      description: hotspot.description,
    });

    if (result.deepLinkUrl) {
      window.open(result.deepLinkUrl, '_blank', 'noopener');
      setCivicStatus('idle');
      return;
    }

    if (result.success) {
      setCivicStatus('success');
      setCivicResult(result);
    } else {
      setCivicStatus('error');
      setCivicError(result.error ?? 'Failed to submit report.');
    }
  }, [hotspot]);

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to feed
          </button>
        )}

        {/* Main card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 m-4">
          {/* Header */}
          <div className="p-5 pb-0">
            <div className="flex items-start gap-4">
              <VoteButton
                upvotes={hotspot.upvotes}
                downvotes={hotspot.downvotes}
                className="shrink-0 pt-1"
              />

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge
                    className="text-white text-[10px]"
                    style={{ backgroundColor: categoryColor } as React.CSSProperties}
                  >
                    {HOTSPOT_CATEGORY_LABELS[hotspot.category]}
                  </Badge>
                  <Badge variant={SEVERITY_VARIANTS[hotspot.severity]}>
                    {SEVERITY_LABELS[hotspot.severity]}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[hotspot.status]}>
                    {STATUS_LABELS[hotspot.status]}
                  </Badge>
                </div>

                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {hotspot.title}
                </h1>

                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{getUserName(hotspot.authorId)}</span>
                  <span>&middot;</span>
                  <span>{timeAgo(hotspot.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400 shrink-0"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{hotspot.address}</span>
              {onViewOnMap && (
                <button
                  type="button"
                  onClick={() => onViewOnMap(hotspot.lat, hotspot.lng)}
                  className="text-blue-600 hover:text-blue-700 underline text-xs ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  View on Map
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="px-5 pt-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              {hotspot.description}
            </p>
          </div>

          {/* Photos */}
          {hotspot.photoUrls.length > 0 && (
            <div className="px-5 pt-4">
              <PhotoGallery urls={hotspot.photoUrls} />
            </div>
          )}

          {/* Action buttons */}
          <div className="px-5 pt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => onDesignFix?.(hotspot.id)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5"
                aria-hidden="true"
              >
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Design a Fix
            </Button>
            <Button
              variant="secondary"
              onClick={() => onSendToRep?.(hotspot.id)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5"
                aria-hidden="true"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Send to My Rep
            </Button>
            <Button
              variant="secondary"
              onClick={handleReportToCity}
              disabled={civicStatus === 'submitting'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5"
                aria-hidden="true"
              >
                <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
              </svg>
              {civicStatus === 'submitting' ? 'Submitting...' : 'Report to City'}
            </Button>
          </div>

          {/* Civic report result */}
          {civicStatus === 'success' && civicResult && (
            <div className="mx-5 mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-sm font-medium text-green-800">
                Report submitted successfully!
              </p>
              {civicResult.trackingId && (
                <p className="text-xs text-green-700 mt-1">
                  Tracking ID: <span className="font-mono">{civicResult.trackingId}</span>
                </p>
              )}
              {civicResult.trackingUrl && (
                <a
                  href={civicResult.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 underline mt-1 inline-block"
                >
                  Track your report &rarr;
                </a>
              )}
            </div>
          )}
          {civicStatus === 'error' && civicError && (
            <div className="mx-5 mt-3 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{civicError}</p>
            </div>
          )}

          {/* Status Timeline */}
          <div className="px-5 pt-6 pb-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Status
            </h3>
            <StatusTimeline currentStatus={hotspot.status} />
          </div>

          {/* Linked Designs */}
          {linkedDesigns.length > 0 && (
            <div className="px-5 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Community Designs ({linkedDesigns.length})
              </h3>
              <div className="space-y-3">
                {linkedDesigns.map((design) => (
                  <DesignCard key={design.id} design={design} />
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="px-5 pt-6 pb-5">
            <CommentThread hotspotId={hotspot.id} comments={comments} />
          </div>
        </div>
      </div>
    </div>
  );
}
