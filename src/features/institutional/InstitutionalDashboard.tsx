import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui';
import {
  HOTSPOT_CATEGORY_LABELS,
  HOTSPOT_CATEGORY_COLORS,
  SEVERITY_LABELS,
} from '@/lib/types/community';
import type {
  HotspotCategory,
  HotspotSeverity,
  HotspotStatus,
} from '@/lib/types/community';
import { useServiceAreas, useHotspotsByServiceArea } from '@/lib/api/use-service-areas';

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

const SEVERITY_COLORS: Record<HotspotSeverity, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
};

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

// ── Local type alias for hotspot documents from Convex ───────────────────

interface HotspotDoc {
  _id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  address: string;
  lat: number;
  lng: number;
  upvotes: number;
  commentCount: number;
  createdAt: number;
  photoUrls?: string[];
  [key: string]: unknown;
}

// ── StatCard ─────────────────────────────────────────────────────────────

const STAT_COLORS: Record<string, { text: string; bg: string; ring: string }> = {
  gray: { text: 'text-gray-900', bg: 'bg-white', ring: 'ring-gray-200' },
  red: { text: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-200' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  blue: { text: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-200' },
};

function StatCard({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const colors = STAT_COLORS[color] ?? STAT_COLORS.gray;

  return (
    <div className={`rounded-lg ${colors.bg} ring-1 ${colors.ring} px-4 py-3`}>
      <p className={`text-2xl font-bold tabular-nums ${colors.text}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── HotspotCard ──────────────────────────────────────────────────────────

function HotspotCard({ hotspot }: { hotspot: HotspotDoc }) {
  const categoryColor =
    HOTSPOT_CATEGORY_COLORS[hotspot.category as HotspotCategory] ?? '#6B7280';
  const netVotes = hotspot.upvotes;

  return (
    <Link
      to={`/hotspot/${hotspot._id}`}
      className="block w-full text-left bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex items-start gap-3">
        {/* Photo thumbnail */}
        {hotspot.photoUrls && hotspot.photoUrls.length > 0 && (
          <img
            src={hotspot.photoUrls[0]}
            alt=""
            className="w-14 h-14 object-cover rounded-md border border-gray-100 shrink-0"
          />
        )}

        {/* Content */}
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
            <Badge variant={SEVERITY_VARIANTS[hotspot.severity as HotspotSeverity] ?? 'default'}>
              {SEVERITY_LABELS[hotspot.severity as HotspotSeverity] ?? hotspot.severity}
            </Badge>
            <Badge variant={STATUS_VARIANTS[hotspot.status as HotspotStatus] ?? 'default'}>
              {STATUS_LABELS[hotspot.status as HotspotStatus] ?? hotspot.status}
            </Badge>
            <span className="text-[10px] text-gray-400 capitalize">
              {HOTSPOT_CATEGORY_LABELS[hotspot.category as HotspotCategory] ??
                hotspot.category.replace(/-/g, ' ')}
            </span>
          </div>

          {/* Address */}
          <p className="text-xs text-gray-500 truncate">{hotspot.address}</p>
        </div>

        {/* Stats column */}
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
              {netVotes}
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
    </Link>
  );
}

// ── Category Breakdown ───────────────────────────────────────────────────

function CategoryBreakdown({ hotspots }: { hotspots: HotspotDoc[] }) {
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of hotspots) {
      counts[h.category] = (counts[h.category] ?? 0) + 1;
    }
    const total = hotspots.length || 1;
    return Object.entries(counts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [hotspots]);

  if (breakdown.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-3">By Category</h3>
      {breakdown.map(({ category, count, percentage }) => (
        <div key={category} className="flex items-center gap-2 mb-2 last:mb-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor:
                HOTSPOT_CATEGORY_COLORS[category as HotspotCategory] ?? '#6B7280',
            }}
            aria-hidden="true"
          />
          <div className="flex-1 text-sm text-gray-600">
            {HOTSPOT_CATEGORY_LABELS[category as HotspotCategory] ??
              category.replace(/-/g, ' ')}
          </div>
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-6 text-right tabular-nums">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Severity Breakdown ───────────────────────────────────────────────────

function SeverityBreakdown({ hotspots }: { hotspots: HotspotDoc[] }) {
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of hotspots) {
      counts[h.severity] = (counts[h.severity] ?? 0) + 1;
    }
    const order: HotspotSeverity[] = ['critical', 'high', 'medium', 'low'];
    return order
      .filter((s) => (counts[s] ?? 0) > 0)
      .map((severity) => ({
        severity,
        count: counts[severity]!,
        label: SEVERITY_LABELS[severity],
        colorClass: SEVERITY_COLORS[severity],
      }));
  }, [hotspots]);

  if (breakdown.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-3">By Severity</h3>
      <div className="space-y-2">
        {breakdown.map(({ severity, count, label, colorClass }) => (
          <div key={severity} className="flex items-center justify-between">
            <span className={`text-sm font-medium ${colorClass}`}>{label}</span>
            <span className="text-sm text-gray-500 tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-gray-50 animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="h-6 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-72 bg-gray-100 rounded" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white ring-1 ring-gray-200 px-4 py-3">
            <div className="h-7 w-10 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col lg:flex-row gap-6 px-6 py-6">
        <div className="flex-1 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-1/2 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="w-full lg:w-80 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3 w-full bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────

interface InstitutionalDashboardProps {
  organizationId?: string;
}

export function InstitutionalDashboard({
  organizationId: propOrgId,
}: InstitutionalDashboardProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const effectiveOrgId = propOrgId ?? orgSlug ?? '';

  // useServiceAreas returns the raw Convex useQuery result:
  // undefined while loading, or an array of service area docs.
  const serviceAreas = useServiceAreas(effectiveOrgId || undefined);

  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  // Auto-select the first service area once loaded
  const activeAreaId =
    selectedAreaId || (serviceAreas && serviceAreas.length > 0 ? serviceAreas[0]._id : '');

  // useHotspotsByServiceArea returns undefined while loading, or an array of hotspot docs.
  const hotspots = useHotspotsByServiceArea(activeAreaId || undefined);

  // Derive the org name from the URL slug (org data isn't on the service area doc)
  const orgName = orgSlug
    ? orgSlug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Organization';

  // Computed stats
  const sortedHotspots = useMemo(() => {
    if (!hotspots) return [];
    return [...(hotspots as HotspotDoc[])].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }, [hotspots]);

  const criticalCount = useMemo(
    () => sortedHotspots.filter((h) => h.severity === 'critical').length,
    [sortedHotspots],
  );

  const openCount = useMemo(
    () => sortedHotspots.filter((h) => h.status === 'open').length,
    [sortedHotspots],
  );

  const thisWeekCount = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sortedHotspots.filter((h) => h.createdAt >= oneWeekAgo).length;
  }, [sortedHotspots]);

  // Loading: service areas haven't resolved yet
  const areasLoading = serviceAreas === undefined && !!effectiveOrgId;
  const hotspotsLoading = hotspots === undefined && !!activeAreaId;

  if (areasLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {orgName} Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Community reports within your service area
            </p>
          </div>
          <div className="flex items-center gap-3">
            {serviceAreas && serviceAreas.length > 1 && (
              <select
                value={activeAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {serviceAreas.map((area: { _id: string; name: string }) => (
                  <option key={area._id} value={area._id}>
                    {area.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
        <StatCard label="Total Reports" value={sortedHotspots.length} />
        <StatCard label="Critical" value={criticalCount} color="red" />
        <StatCard label="Open" value={openCount} color="amber" />
        <StatCard label="This Week" value={thisWeekCount} color="blue" />
      </div>

      {/* Main content: feed + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6 px-6 py-6 max-w-7xl mx-auto">
        {/* Left: Report feed */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Recent Reports
            </h2>
            {!hotspotsLoading && (
              <span className="text-xs text-gray-400">
                {sortedHotspots.length} report
                {sortedHotspots.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {hotspotsLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Loading reports...</span>
            </div>
          ) : sortedHotspots.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                No community reports yet
              </p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                No community reports in this service area yet. Reports will
                appear here as community members flag issues.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedHotspots.map((hotspot) => (
                <HotspotCard key={hotspot._id} hotspot={hotspot} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Sidebar with breakdowns */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <CategoryBreakdown hotspots={sortedHotspots} />
          <SeverityBreakdown hotspots={sortedHotspots} />
        </div>
      </div>
    </div>
  );
}

// Default export for React.lazy() compatibility
export default InstitutionalDashboard;
