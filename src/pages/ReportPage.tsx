import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { ReportBuilder } from '@/features/report/ReportBuilder';
import { useHotspotById, mockHotspotToPin } from '@/lib/api/use-hotspots';
import { convexAvailable } from '@/lib/api/convex-provider';
import { useDesignById } from '@/lib/api/use-designs';
import { useProposalStore } from '@/stores/proposal-store';
import { observationBriefContext } from '@/features/community/observation-brief-store';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function ReportPage() {
  const [searchParams] = useSearchParams();
  const { designId } = useParams();
  const hotspotId = searchParams.get('hotspot') ?? undefined;
  if (designId) return <ErrorBoundary key={designId}><DesignReportContext designId={designId} /></ErrorBoundary>;
  return <ErrorBoundary key={hotspotId}><ReportContext hotspotId={hotspotId} /></ErrorBoundary>;
}

function ReportContext({ hotspotId }: { hotspotId?: string }) {
  const navigate = useNavigate();

  const { hotspot: rawHotspot, isLoading } = useHotspotById(hotspotId);
  if (hotspotId && isLoading) {
    return <p role="status" className="p-6 text-slate-600">Loading the community report…</p>;
  }
  if (hotspotId && (!rawHotspot || (!convexAvailable && !rawHotspot.id.startsWith('local-')))) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-slate-900">
          {rawHotspot ? 'Example reports cannot be sent to representatives' : 'Community report not found'}
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          {rawHotspot
            ? 'Illustrative reports contain fictional observations and sample support counts. Start with your own observations to prepare a message.'
            : 'This report is unavailable. Local demo reports disappear on reload. Choose an available report or start with your own observations.'}
        </p>
        <Link to="/map" className="inline-block text-blue-700 underline underline-offset-4">Choose your location on the map</Link>
      </div>
    );
  }
  const hotspotPin = rawHotspot ? mockHotspotToPin(rawHotspot) : null;

  return (
    <div className="h-full overflow-y-auto p-4">
      <ReportBuilder
        hotspot={hotspotPin}
        initialAddress={rawHotspot?.address}
        briefContext={rawHotspot ? observationBriefContext(rawHotspot, convexAvailable ? 'community' : 'browser-session') : undefined}
        onClose={() => navigate(-1)}
      />
    </div>
  );
}

function DesignReportContext({ designId }: { designId: string }) {
  const navigate = useNavigate();
  const result = useDesignById(designId);
  const proposal = useProposalStore((state) => state.afterStreet?.id === (result.status === 'ready' ? result.street.id : null) ? state.briefContext : undefined);
  if (result.status === 'loading') return <p role="status" className="p-6">Loading the street concept…</p>;
  if (result.status !== 'ready') return <div className="space-y-4 p-6"><h1 className="text-xl font-semibold">Street concept unavailable</h1><p>This concept could not be loaded. It may be private, removed, or unavailable on this connection.</p><Link to="/map" className="underline">Return to your work on the map</Link></div>;
  const { street, beforeStreet } = result;
  if (!street.location) return <div className="space-y-4 p-6"><h1 className="text-xl font-semibold">Add a location before contacting a representative</h1><p>This concept has no saved location. Review the street and its address before choosing a recipient.</p><Link to={`/editor/${encodeURIComponent(designId)}`} className="underline">Open street concept</Link></div>;
  return <div className="h-full overflow-y-auto p-4"><ReportBuilder
    design={{ id: designId, title: street.name, ...street.location, upvotes: 0, prowagPass: false, checksAvailable: false }}
    initialAddress={street.location.address} street={street} beforeStreet={beforeStreet}
    briefContext={proposal} onClose={() => navigate(-1)}
  /></div>;
}
