import { useNavigate } from 'react-router-dom';
import { HotspotExplorer } from '@/features/community/HotspotExplorer';

export default function HotspotFeedPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full">
      <HotspotExplorer
        onSelectHotspot={(id) => navigate(`/hotspot/${id}`)}
      />
    </div>
  );
}
