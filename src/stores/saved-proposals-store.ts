import { create } from 'zustand';
import type { StreetProposal, StreetSegment } from '@/lib/types';
import { DEFAULT_CONSTRAINTS } from '@/lib/constants';

export const SAVED_PROPOSALS_KEY = 'curbwise-proposal-drafts-v1';
const STORAGE_ERROR = 'Drafts could not be saved in this browser. Your proposal is still open. Free up browser storage or download a PDF, then try again.';
const READ_ERROR = 'Saved drafts could not be read. Your existing browser data has not been changed.';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const point = (value: unknown) => object(value) && finite(value.lat) && Math.abs(value.lat) <= 90 && finite(value.lng) && Math.abs(value.lng) <= 180;
const metadata = (value: unknown) => object(value) && date(value.createdAt) && date(value.updatedAt);

function briefContext(value: unknown): boolean {
  if (!object(value) || !['concern', 'desiredOutcome', 'requestedNextStep', 'dimensionSource'].every((key) => text(value[key])) ||
    !['assumed', 'estimated', 'measured'].includes(String(value.dimensionBasis))) return false;
  const observation = value.observation;
  return observation === undefined || (point(observation) && object(observation) &&
    text(observation.id) && observation.id.length > 0 && text(observation.title) && text(observation.description) &&
    text(observation.address) && finite(observation.createdAt) && observation.createdAt >= 0 &&
    ['community', 'example', 'browser-session'].includes(String(observation.source)) &&
    Array.isArray(observation.photoUrls) && observation.photoUrls.every(text));
}

function street(value: unknown): value is StreetSegment {
  return object(value) && text(value.id) && text(value.name) &&
    finite(value.totalROWWidth) && finite(value.curbToCurbWidth) &&
    ['one-way', 'two-way'].includes(String(value.direction)) &&
    ['local', 'collector', 'minor-arterial', 'major-arterial'].includes(String(value.functionalClass)) &&
    metadata(value.metadata) && Array.isArray(value.elements) && value.elements.every((element: unknown) =>
      object(element) && text(element.id) && text(element.type) && Object.prototype.hasOwnProperty.call(DEFAULT_CONSTRAINTS, element.type) &&
      ['left', 'right', 'center'].includes(String(element.side)) && finite(element.width) && element.width >= 0 &&
      typeof element.locked === 'boolean' &&
      (element.label === undefined || text(element.label)) && (element.variant === undefined || text(element.variant)) && object(element.constraints) &&
      ['absoluteMin', 'recommendedMin', 'recommended', 'absoluteMax'].every((key) => finite((element.constraints as JsonObject)[key])) &&
      text(element.constraints.source) && typeof element.constraints.prowagRequired === 'boolean',
    );
}

function readProposals(): Record<string, StreetProposal> {
  const raw = localStorage.getItem(SAVED_PROPOSALS_KEY);
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!object(parsed) || parsed.version !== 1 || !Array.isArray(parsed.proposals)) throw new Error(READ_ERROR);
  const proposals: Record<string, StreetProposal> = {};
  for (const proposal of parsed.proposals) {
    if (!object(proposal) || !text(proposal.id) || !proposal.id || !text(proposal.streetName) ||
      !point(proposal.location) || !text((proposal.location as JsonObject).address) ||
      !Array.isArray(proposal.roadPath) || !proposal.roadPath.every(point) || !finite(proposal.bearing) ||
      !text(proposal.beforePresetId) || !text(proposal.transformationTemplateId) ||
      !street(proposal.beforeStreet) || !street(proposal.afterStreet) || !metadata(proposal.metadata) ||
      (proposal.briefContext !== undefined && !briefContext(proposal.briefContext))) {
      throw new Error(READ_ERROR);
    }
    Object.defineProperty(proposals, proposal.id, { value: proposal as unknown as StreetProposal, enumerable: true, configurable: true, writable: true });
  }
  return proposals;
}

function persist(proposals: Record<string, StreetProposal>) {
  const serialized = JSON.stringify({ version: 1, proposals: Object.values(proposals) });
  localStorage.setItem(SAVED_PROPOSALS_KEY, serialized);
  // Snapshot the draft so further editing cannot mutate the saved copy.
  return JSON.parse(serialized).proposals as StreetProposal[];
}

export interface SavedProposalsState {
  proposals: Record<string, StreetProposal>;
  storageError: string | null;
  loadProposals: () => void;
  saveProposal: (proposal: StreetProposal) => void;
  removeProposal: (id: string) => void;
  getProposal: (id: string) => StreetProposal | undefined;
}

export const useSavedProposalsStore = create<SavedProposalsState>()((set, get) => ({
  proposals: {},
  storageError: null,
  loadProposals: () => {
    try { set({ proposals: readProposals(), storageError: null }); }
    catch { set({ storageError: READ_ERROR }); }
  },
  saveProposal: (proposal) => {
    try {
      const proposals = { ...readProposals(), [proposal.id]: proposal };
      const snapshots = persist(proposals);
      set({ proposals: Object.fromEntries(snapshots.map((draft) => [draft.id, draft])), storageError: null });
    } catch {
      set({ storageError: STORAGE_ERROR });
      throw new Error(STORAGE_ERROR);
    }
  },
  removeProposal: (id) => {
    try {
      const proposals = readProposals();
      delete proposals[id];
      persist(proposals);
      set({ proposals, storageError: null });
    } catch {
      const message = 'This draft could not be removed from browser storage. It is still available.';
      set({ storageError: message });
      throw new Error(message);
    }
  },
  getProposal: (id) => Object.prototype.hasOwnProperty.call(get().proposals, id) ? get().proposals[id] : undefined,
}));
