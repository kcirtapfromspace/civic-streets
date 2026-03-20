import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ReportBuilder } from '@/features/report/ReportBuilder';
import { useHotspotById, mockHotspotToPin } from '@/lib/api/use-hotspots';

export default function ReportPage() {
  const { designId } = useParams<{ designId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hotspotId = searchParams.get('hotspot') ?? undefined;

  const { hotspot: rawHotspot } = useHotspotById(hotspotId);
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
