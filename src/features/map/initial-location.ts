import { fetchApproximateLocation } from '@/lib/api/ip-location';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, useMapStore } from './map-store';

/** Once per app session, including StrictMode mounts and returns from other pages. */
export async function initializeMapLocation(): Promise<void> {
  const state = useMapStore.getState();
  if (state.initialLocationStatus !== 'idle') return;
  if (state.selectedLocation || state.contextMenuPosition || state.reportFormOpen
    || state.lockedToLocation || state.center.lat !== DEFAULT_MAP_CENTER.lat
    || state.center.lng !== DEFAULT_MAP_CENTER.lng || state.zoom !== DEFAULT_MAP_ZOOM) {
    useMapStore.setState({ initialLocationStatus: 'skipped' });
    return;
  }
  useMapStore.setState({ initialLocationStatus: 'loading' });
  const location = await fetchApproximateLocation();
  // Any intentional pan, zoom, selected result, draft, or report wins over this hint.
  if (useMapStore.getState().initialLocationStatus !== 'loading') return;
  useMapStore.setState(location ? {
    center: location.center,
    zoom: location.zoom,
    initialLocationStatus: 'located',
    initialLocationLabel: location.label,
  } : { initialLocationStatus: 'fallback' });
}
