import type { DiscussionBriefContext, StreetLocation } from '@/lib/types';
import type { SafetyDataState } from './safety-data-store';
import { DATA_SOURCES } from './api';

/** Great-circle distance keeps the radius meaningful at different latitudes. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

type EvidenceState = Pick<SafetyDataState, 'crashes' | 'sources' | 'coverage' | 'lastBounds' | 'isLoading' | 'error' | 'enabled' | 'filters'>;

export function crashBriefEvidence(location: StreetLocation, state: EvidenceState): DiscussionBriefContext['supportingEvidence'] | null {
  const bounds = state.lastBounds;
  if (!state.enabled || state.isLoading || !state.coverage || state.coverage === 'unsupported' || !bounds ||
    location.lat < bounds.south || location.lat > bounds.north || location.lng < bounds.west || location.lng > bounds.east ||
    !state.sources.some((source) => source.status !== 'error')) return null;
  const nearby = state.crashes.filter((crash) => distanceMeters(location, crash) <= 200 &&
    state.filters.severities.has(crash.severity) && crash.modes.some((mode) => state.filters.modes.has(mode)));
  const sourceDetails = state.sources.flatMap((result) => {
    const source = DATA_SOURCES.find((item) => item.id === result.sourceId);
    return source ? [{ source, result }] : [];
  });
  if (!sourceDetails.some(({ source, result }) => result.status !== 'error' &&
    location.lat >= source.bounds[0] && location.lng >= source.bounds[1] &&
    location.lat <= source.bounds[2] && location.lng <= source.bounds[3])) return null;
  return {
    title: 'Nearby crash records',
    capturedAt: new Date().toISOString(),
    summary: `${nearby.length} mapped record${nearby.length === 1 ? '' : 's'} within 200 m of the selected location; ${nearby.filter((crash) => crash.severity === 'fatal').length} recorded as fatal crashes.`,
    details: [
      'Snapshot of available mapped records, not a risk estimate or a complete count of incidents. A local observation remains useful without crash records.',
      'Only records returned for the current map view are counted. Parts of the 200 m radius beyond that view or the dataset boundary may be missing.',
      state.filters.dateRange ? `Requested dates: ${state.filters.dateRange.start} through ${state.filters.dateRange.end}.` : 'Requested dates: the connected sources’ default period (see source coverage below).',
      `Included modes: ${[...state.filters.modes].join(', ') || 'none'}. Severity filters: ${[...state.filters.severities].join(', ') || 'none'}.`,
      ...sourceDetails.flatMap(({ source, result }) => [
        `${source.name}: ${result.history ? 'One-year archive; monthly imports.' : source.dateRange}. ${source.coverageNote}`,
        ...(result.status === 'partial' ? ['This source returned incomplete results.'] : []),
        ...(result.status === 'error' ? ['This source was unavailable.'] : []),
        ...result.warnings,
      ]),
      ...(state.error ? ['Some crash data was unavailable when this snapshot was made.'] : []),
    ],
    sources: sourceDetails.map(({ source }) => ({ label: source.name, url: source.url })),
  };
}
