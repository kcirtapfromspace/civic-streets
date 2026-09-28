import { useParams, useNavigate, Link } from 'react-router-dom';
import { HotspotDetail } from '@/features/community/HotspotDetail';
import { useHotspotById } from '@/lib/api/use-hotspots';
import { useMapStore } from '@/features/map/map-store';
import { useStartProposal } from '@/features/proposal/useStartProposal';
import { convexAvailable } from '@/lib/api/convex-provider';
import { ErrorBoundary } from '@/components/ui';

function HotspotDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hotspot, isLoading } = useHotspotById(id);
  const setCenter = useMapStore((s) => s.setCenter);
  const setZoom = useMapStore((s) => s.setZoom);
  const { startProposal, confirmation } = useStartProposal();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hotspot) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Observation not found</h1>
        <p className="text-gray-500">
          Observation <span className="font-mono text-gray-700">{id}</span> could not be found.
        </p>
        <Link
          to="/hotspots"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          &larr; Back to observations
        </Link>
      </div>
    );
  }

  const handleDesignFix = () => {
    startProposal({
      streetName: hotspot.address.split(',')[0].trim() || hotspot.title,
      location: { lat: hotspot.lat, lng: hotspot.lng, address: hotspot.address },
      observation: {
        id: hotspot.id, title: hotspot.title, description: hotspot.description,
        photoUrls: [...hotspot.photoUrls], lat: hotspot.lat, lng: hotspot.lng,
        address: hotspot.address, createdAt: hotspot.createdAt,
        source: convexAvailable ? 'community' : hotspot.id.startsWith('local-') ? 'browser-session' : 'example',
      },
      onStarted: () => navigate('/map'),
    });
  };

  const handleSendToRep = () => {
    navigate(`/report?hotspot=${hotspot.id}`);
  };

  const handleViewOnMap = (lat: number, lng: number) => {
    setCenter({ lat, lng });
    setZoom(17);
    navigate('/map');
  };

  return (
    <div className="h-full overflow-y-auto">
      <HotspotDetail
        hotspot={hotspot}
        onBack={() => navigate('/hotspots')}
        onDesignFix={handleDesignFix}
        onSendToRep={handleSendToRep}
        onViewOnMap={handleViewOnMap}
      />
      {confirmation}
    </div>
  );
}

export default function HotspotDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ErrorBoundary key={id}>
      <HotspotDetailContent />
    </ErrorBoundary>
  );
}
