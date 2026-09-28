import { useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { useProposalStore } from '@/stores/proposal-store';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useWorkDraftsStore } from '@/stores/work-drafts-store';
import { useMapStore } from './map-store';
import { useStyleReload } from './useStyleReload';
import { computeBearing } from '@/features/proposal/utils/road-geometry';
import { renderStreetOnMap, cleanupMapLayers, cleanupMapSource, type RenderStreetResult } from '@/features/proposal/utils/render-street-layers';

type Point = { lat: number; lng: number };
const PREFIX = 'street-placement';
const CONTROL = 'min-h-11 rounded-sm border border-[#d8dddf] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2';

/** Preview a contributor-drawn centerline before assigning it to the existing draft. */
export function StreetPlacement({ map, error }: { map: maplibregl.Map | null; error: string | null }) {
  const street = useProposalStore((state) => state.afterStreet);
  const name = useProposalStore((state) => state.streetName);
  const storageError = useWorkDraftsStore((state) => state.storageError);
  const [points, setPoints] = useState<Point[]>(() => [...useProposalStore.getState().roadPath]);
  const [address, setAddress] = useState(() => useProposalStore.getState().location?.address ?? name);
  const [saveError, setSaveError] = useState('');
  const styleVersion = useStyleReload(map);

  const cancel = () => {
    useWorkDraftsStore.getState().load();
    useWorkspaceStore.setState({ mode: 'propose', designProposalId: null });
  };

  useEffect(() => {
    useMapStore.getState().closeContextMenu();
    const location = useProposalStore.getState().location;
    if (location) useMapStore.getState().setCenter(location);
    useMapStore.getState().setZoom(Math.max(useMapStore.getState().zoom, 17));
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);

  const addPoint = (point: Point) => {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 85 || Math.abs(point.lng) > 180) return;
    setPoints((current) => current.some((p) => p.lat === point.lat && p.lng === point.lng) ? current : [...current, point]);
  };

  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    const click = (event: maplibregl.MapMouseEvent) => addPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    map.on('click', click);
    return () => { map.off('click', click); canvas.style.cursor = previousCursor; };
  }, [map]);

  useEffect(() => {
    if (!map || !street || !map.isStyleLoaded()) return;
    let rendered: RenderStreetResult = {
      sourceIds: [`${PREFIX}-highlight`, `${PREFIX}-elements`],
      layerIds: [`${PREFIX}-highlight-line`, ...street.elements.flatMap((_, index) => [`${PREFIX}-element-fill-${index}`, `${PREFIX}-element-stroke-${index}`])],
    };
    const markerSource = `${PREFIX}-points`;
    const markerLayer = `${PREFIX}-points-circle`;
    const cleanup = () => {
      cleanupMapLayers(map, [markerLayer, ...rendered.layerIds]);
      for (const source of [markerSource, ...rendered.sourceIds]) cleanupMapSource(map, source);
    };
    try {
      rendered = renderStreetOnMap(map, PREFIX, points, street);
      map.addSource(markerSource, { type: 'geojson', data: { type: 'FeatureCollection', features: points.map((point) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } })) } });
      map.addLayer({ id: markerLayer, type: 'circle', source: markerSource, paint: { 'circle-radius': 6, 'circle-color': '#172126', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    } catch {
      // A style swap removes custom layers; useStyleReload restores the preview.
      cleanup();
    }
    return cleanup;
  }, [map, points, street, styleVersion]);

  const finish = () => {
    const proposal = useProposalStore.getState();
    const work = proposal.getWork();
    if (points.length < 2 || !proposal.afterStreet || !work) return;
    const location = { lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length, lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length, address: address.trim() || name };
    const afterStreet = { ...proposal.afterStreet, location };
    const beforeStreet = proposal.beforeStreet ? { ...proposal.beforeStreet, location } : null;
    const placedWork = { ...work, location, roadPath: points, bearing: computeBearing(points[0], points[points.length - 1]), beforeStreet, afterStreet, showBeforeOnMap: false };
    const previousPending = useWorkDraftsStore.getState().pending;
    if (!useWorkDraftsStore.getState().save(placedWork)) {
      // Keep this tentative placement in the panel, so cancelling never changes the draft.
      useWorkDraftsStore.setState({ pending: previousPending });
      setSaveError('This placement could not be saved. Keep this page open and retry; your layout is still here.');
      return;
    }
    useProposalStore.getState().loadWork(placedWork);
    useStreetStore.getState().setStreet(afterStreet);
    useStreetStore.getState().setBeforeStreet(beforeStreet);
    useStreetStore.temporal.getState().clear();
    useWorkspaceStore.getState().enterDesignMode(location, work.id);
    useWorkspaceStore.setState({ showElementPanel: false, showValidationPanel: false, dockExpanded: false });
  };

  return <>
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-3xl text-[#172126] [text-shadow:0_0_3px_white]">+</div>
    <section aria-label="Place street on map" className="absolute bottom-4 left-4 right-4 z-30 flex max-h-[36dvh] flex-col rounded-sm border border-[#d8dddf] bg-white p-4 text-[#172126] shadow-lg sm:right-auto sm:max-h-[55dvh] sm:w-[360px]">
      <h2 className="shrink-0 text-base font-semibold">Place {name} on the map</h2>
      {map && !error && <p role="status" className="mt-2 shrink-0 text-xs">{points.length} {points.length === 1 ? 'point' : 'points'} marked{points.length >= 2 ? ' · Layout preview shown' : ''}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
      <p className="mt-2 text-sm leading-5">Mark two or more points along the street centerline. Add points at bends, in order.</p>
      {error ? <p role="alert" className="mt-2 text-sm text-red-800">The map is unavailable. Use Map options to try another style, or return to your saved brief and try again.</p> : !map ? <p role="status" className="mt-2 text-sm">Loading the map…</p> : <>
        <label className="mt-3 block text-xs font-medium">Location description<input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} className="mt-1 min-h-11 w-full border border-[#d8dddf] px-2 text-sm" /></label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" aria-label="Add map center" className={CONTROL} onClick={() => addPoint(map.getCenter())}>Add center</button>
          <button type="button" className={CONTROL} disabled={!points.length} onClick={() => setPoints((current) => current.slice(0, -1))}>Undo point</button>
          <button type="button" aria-label="Redraw path" className={CONTROL} disabled={!points.length} onClick={() => setPoints([])}>Redraw</button>
        </div>
        <details className="mt-2 text-xs text-[#59646a]"><summary className="min-h-11 cursor-pointer content-center">Placement guidance</summary><p>Left and right follow the direction from your first point to your last. You can also focus the map, use arrow keys to move it, then add the center point.</p><p className="mt-2">This is an approximate placement, not a surveyed design.</p></details>
      </>}
      {(saveError || storageError) && <p role="alert" className="mt-2 text-sm text-red-800">{saveError || storageError}</p>}
      </div>
      <div className="mt-3 flex shrink-0 gap-2 border-t border-[#d8dddf] pt-3">
        <button type="button" className={CONTROL} onClick={cancel}>Cancel placement</button>
        <button type="button" className={`${CONTROL} bg-[#172126] text-white disabled:bg-[#d8dddf] disabled:text-[#59646a]`} disabled={!map || !!error || points.length < 2 || !street} onClick={finish}>Use this placement</button>
      </div>
    </section>
  </>;
}
