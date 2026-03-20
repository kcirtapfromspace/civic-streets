import { useNavigate } from 'react-router-dom';
import { HotspotFeed } from '@/features/community/HotspotFeed';

export default function HotspotFeedPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto">
      <HotspotFeed
        onSelectHotspot={(id) => navigate(`/hotspot/${id}`)}
      />
    </div>
  );
}
