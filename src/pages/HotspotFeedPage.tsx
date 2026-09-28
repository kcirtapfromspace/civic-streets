import { useNavigate } from 'react-router-dom';
import { HotspotExplorer } from '@/features/community/HotspotExplorer';
import { ErrorBoundary } from '@/components/ui';

export default function HotspotFeedPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full">
      <ErrorBoundary>
        <HotspotExplorer
          onSelectHotspot={(id) => navigate(`/hotspot/${id}`)}
        />
      </ErrorBoundary>
    </div>
  );
}
