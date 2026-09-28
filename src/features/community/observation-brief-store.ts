import type { DiscussionBriefContext, ObservationSnapshot } from '@/lib/types';
import type { MockHotspot } from './mock-data';

const STORAGE_KEY = 'curbwise-observation-briefs-v1';
type BriefNotes = Pick<DiscussionBriefContext, 'desiredOutcome' | 'requestedNextStep' | 'revisedAt'>;

function readNotes(): Record<string, BriefNotes> {
  const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.values(value).every((notes) =>
    notes && typeof notes === 'object' && typeof notes.desiredOutcome === 'string' && typeof notes.requestedNextStep === 'string' &&
    (notes.revisedAt === undefined || typeof notes.revisedAt === 'string'))) throw new Error('Invalid saved notes');
  return value as Record<string, BriefNotes>;
}

export function observationBriefContext(hotspot: Pick<MockHotspot, 'id' | 'title' | 'description' | 'photoUrls' | 'lat' | 'lng' | 'address' | 'createdAt'>, source: ObservationSnapshot['source']): DiscussionBriefContext {
  let notes: BriefNotes | undefined;
  try { notes = readNotes()[hotspot.id]; } catch { /* Keep the observation usable if storage is unavailable. */ }
  return {
    concern: hotspot.description || hotspot.title,
    desiredOutcome: typeof notes?.desiredOutcome === 'string' ? notes.desiredOutcome : '',
    requestedNextStep: typeof notes?.requestedNextStep === 'string' ? notes.requestedNextStep : '',
    dimensionBasis: 'assumed', dimensionSource: '',
    briefId: `observation-${hotspot.id}`,
    revisedAt: typeof notes?.revisedAt === 'string' ? notes.revisedAt : new Date(hotspot.createdAt).toISOString(),
    sourceUrl: source === 'community' ? `${window.location.origin}/hotspot/${encodeURIComponent(hotspot.id)}` : undefined,
    observation: {
      id: hotspot.id, title: hotspot.title, description: hotspot.description,
      photoUrls: [...hotspot.photoUrls], lat: hotspot.lat, lng: hotspot.lng,
      address: hotspot.address, createdAt: hotspot.createdAt, source,
    },
  };
}

/** Write the purpose fields only; the public observation is never changed here. */
export function saveObservationBrief(id: string, notes: BriefNotes): string | null {
  try {
    const all = readNotes();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [id]: notes }));
    return null;
  } catch {
    return 'These brief notes could not be saved in this browser. Keep this page open and download a copy before leaving.';
  }
}
