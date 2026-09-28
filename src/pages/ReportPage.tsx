import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ReportBuilder } from '@/features/report/ReportBuilder';
import { useHotspotById, mockHotspotToPin } from '@/lib/api/use-hotspots';
import { convexAvailable } from '@/lib/api/convex-provider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function ReportPage() {
  const [searchParams] = useSearchParams();
  const hotspotId = searchParams.get('hotspot') ?? undefined;
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
        onClose={() => navigate(-1)}
      />
    </div>
  );
}
