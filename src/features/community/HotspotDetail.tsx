import { findReportingArea } from '../../../shared/reporting-areas';
import React, { useState } from 'react';
import { Badge } from '@/components/ui';
import {
  HOTSPOT_CATEGORY_LABELS,
  HOTSPOT_CATEGORY_COLORS,
  SEVERITY_LABELS,
  ISSUE_GROUP_LABELS,
} from '@/lib/types/community';
import type { HotspotStatus } from '@/lib/types/community';
import { VoteButton } from './VoteButton';
import type { MockHotspot } from './mock-data';
import { getCityDeepLink } from '@/lib/api/civic/deeplinks';
import { useVoteOnHotspot } from '@/lib/api/use-hotspots';
import { convexAvailable } from '@/lib/api/convex-provider';
import { getIssueTypeConfig } from '@/lib/config/issue-types';
import { ObservationBrief } from './ObservationBrief';

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
    <div
      className="flex items-center gap-1"
      aria-label={`Community status: ${STATUS_LABELS[currentStatus]}`}
    >
      {STATUS_STEPS.map((step, i) => {
        const isReached = i <= currentIndex;
        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <div
                className={`flex-1 h-0.5 ${isReached ? 'bg-civic-ink' : 'bg-gray-200'}`}
                aria-hidden="true"
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isReached ? 'bg-civic-ink border-civic-ink' : 'bg-white border-gray-300'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] leading-none ${
                  isReached ? 'text-civic-ink font-medium' : 'text-gray-400'
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
  const voteOnHotspot = useVoteOnHotspot();
  const cityPortal = getCityDeepLink(hotspot.lat, hotspot.lng);
  const cityHelpId = React.useId();
  const repHelpId = React.useId();
  const reportingAllowed = Boolean(findReportingArea(hotspot.lat, hotspot.lng));
  const isExample = !convexAvailable && !hotspot.id.startsWith('local-');
  const sourceLabel = convexAvailable
    ? 'Community observation'
    : isExample
      ? 'Example observation'
      : 'Browser-session observation';
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteReset, setVoteReset] = useState(0);

  const handleVote = async (value: 1 | -1) => {
    setVoteError(null);
    try {
      await voteOnHotspot(hotspot.id, value);
    } catch {
      setVoteError('Your vote could not be saved. Please try again.');
      setVoteReset((previous) => previous + 1);
    }
  };

  return (
    <div className="min-h-full bg-civic-wash text-civic-ink">
      <div className="mx-auto max-w-2xl px-4 py-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex min-h-11 items-center gap-2 text-sm text-civic-muted hover:text-civic-ink"
          >
            <span aria-hidden="true">←</span> Back to observations
          </button>
        )}
        <article className="rounded border border-civic-line bg-white">
          <header className="space-y-3 border-b border-civic-line p-5">
            <p className="text-xs text-civic-muted">{sourceLabel} · {timeAgo(hotspot.createdAt)}</p>
            <h1 className="text-2xl font-semibold leading-tight">{hotspot.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
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
                Community: {STATUS_LABELS[hotspot.status]}
              </Badge>
            </div>
            {!convexAvailable && (
              <p className="text-sm text-civic-muted">
                {isExample
                  ? 'This is an illustrative example, not an observation from a resident. Sample status and counts do not reflect community activity.'
                  : 'This observation is stored only in this browser session. It disappears on reload and has not been published to the community.'}
              </p>
            )}
          </header>

          <section aria-label="Observation details" className="space-y-5 p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs text-civic-muted">Location</dt>
                <dd className="mt-1">{hotspot.address}</dd>
                <dd className="mt-1 text-xs text-civic-muted">
                  {hotspot.lat.toFixed(5)}, {hotspot.lng.toFixed(5)}
                </dd>
              </div>
              {hotspot.issueGroup && (
                <div>
                  <dt className="text-xs text-civic-muted">Issue group</dt>
                  <dd className="mt-1">{ISSUE_GROUP_LABELS[hotspot.issueGroup] ?? hotspot.issueGroup}</dd>
                </div>
              )}
              {hotspot.issueType && (
                <div>
                  <dt className="text-xs text-civic-muted">Issue type</dt>
                  <dd className="mt-1">{getIssueTypeConfig(hotspot.issueType)?.label ?? hotspot.issueType}</dd>
                </div>
              )}
              {hotspot.isBlocking !== undefined && (
                <div>
                  <dt className="text-xs text-civic-muted">Blocking passage</dt>
                  <dd className="mt-1">{hotspot.isBlocking ? 'Yes' : 'No'}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-civic-muted">Saved</dt>
                <dd className="mt-1">
                  <time dateTime={new Date(hotspot.createdAt).toISOString()}>
                    {new Date(hotspot.createdAt).toLocaleString()}
                  </time>
                </dd>
              </div>
            </dl>
            <div>
              <h2 className="mb-2 text-sm font-medium">Notes</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-civic-muted">
                {hotspot.description || 'No notes added.'}
              </p>
            </div>
            {hotspot.photoUrls.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium">Photos</h2>
                <PhotoGallery urls={hotspot.photoUrls} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {onViewOnMap && (
                <button
                  type="button"
                  onClick={() => onViewOnMap(hotspot.lat, hotspot.lng)}
                  className="min-h-11 rounded border border-civic-line px-4 text-sm font-medium hover:bg-civic-wash"
                >
                  View on Map
                </button>
              )}
              <button
                type="button"
                onClick={() => onDesignFix?.(hotspot.id)}
                disabled={!onDesignFix}
                className="min-h-11 rounded bg-civic-ink px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Explore a change here
              </button>
            </div>
          </section>

          <ObservationBrief key={`brief-${hotspot.id}`} hotspot={hotspot} source={convexAvailable ? 'community' : isExample ? 'example' : 'browser-session'} />

          <section aria-label="Community status" className="space-y-3 border-t border-civic-line p-5">
            <h2 className="text-sm font-medium">Community status</h2>
            <StatusTimeline currentStatus={hotspot.status} />
            <p className="text-xs leading-5 text-civic-muted">
              This status is recorded on Curbwise. It does not confirm city receipt, work in
              progress, or a city-verified repair.
            </p>
            {convexAvailable && (
              <VoteButton
                key={`${hotspot.id}-${voteReset}`}
                upvotes={hotspot.upvotes}
                downvotes={hotspot.downvotes}
                onVote={handleVote}
              />
            )}
            {voteError && <p role="alert" className="text-sm text-red-700">{voteError}</p>}
            <p className="text-xs leading-5 text-civic-muted">
              Discussion and linked community designs are not available for this observation.
            </p>
          </section>

          <details key={hotspot.id} className="border-t border-civic-line">
            <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-medium">
              Optional follow-up
            </summary>
            <div className="space-y-4 px-5 pb-5">
              <p className="text-sm text-civic-muted">
                Your observation stands on its own. If you want to take it further, you can contact
                the city or prepare a representative draft.
              </p>
              <div className="space-y-2">
                {cityPortal ? (
                  <a
                    href={cityPortal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-describedby={cityHelpId}
                    className="inline-flex min-h-11 items-center rounded border border-civic-line px-4 text-sm font-medium hover:bg-civic-wash"
                  >
                    {cityPortal.city === 'Denver'
                      ? 'Continue at Denver 311'
                      : `Continue at ${cityPortal.city} reporting`}
                  </a>
                ) : (
                  <button type="button" disabled aria-describedby={cityHelpId} className="min-h-11 rounded border border-civic-line px-4 text-sm text-civic-muted">
                    City reporting unavailable
                  </button>
                )}
                <p id={cityHelpId} className="text-xs leading-5 text-civic-muted">
                  {cityPortal ? (
                    <>
                      To create a city case, confirm the location is inside{' '}
                      {cityPortal.city === 'Denver' ? 'the City and County of Denver' : cityPortal.city}{' '}
                      and complete the city's form. The portal opens in a new tab; details and photos are
                      not transferred automatically. Curbwise does not submit or track the city case.
                    </>
                  ) : (
                    'We do not have a verified public reporting link for this location. Visit your local government website to find its reporting service.'
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onSendToRep?.(hotspot.id)}
                  disabled={isExample || !reportingAllowed || !onSendToRep}
                  aria-describedby={repHelpId}
                  className="min-h-11 rounded border border-civic-line px-4 text-sm font-medium hover:bg-civic-wash disabled:text-civic-muted"
                >
                  Prepare a representative draft
                </button>
                <p id={repHelpId} className="text-xs leading-5 text-civic-muted">
                  {isExample
                    ? 'Representative drafts are unavailable for fictional examples. Capture your own observation first.'
                    : reportingAllowed && onSendToRep
                      ? 'This opens a draft for you to review. No message is sent from this page.'
                      : 'Representative drafts are unavailable here. Visit your local government website to find your representative.'}
                </p>
              </div>
            </div>
          </details>
        </article>
      </div>
    </div>
  );
}
