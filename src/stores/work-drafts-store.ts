import { create } from 'zustand';
import type { DiscussionBriefContext, StreetLocation, StreetSegment } from '@/lib/types';
import type { IntersectionConditions, CrashSummary } from '@/lib/types/intersection';
import { isBriefContext, isStreet, isPoint } from './saved-proposals-store';

export type StreetWorkStep = 'concern' | 'street-selected' | 'before-selected' | 'transform-selected' | 'review' | 'brief';
interface WorkBase {
  id: string;
  name: string;
  location: StreetLocation | null;
  createdAt: string;
  updatedAt: string;
  briefContext: DiscussionBriefContext;
  archived?: boolean;
  followUp?: string;
}
export interface StreetWork extends WorkBase {
  kind: 'street';
  step: StreetWorkStep;
  roadPath: Array<{ lat: number; lng: number }>;
  bearing: number;
  beforePresetId: string | null;
  beforeStreet: StreetSegment | null;
  afterStreet: StreetSegment | null;
  selectedTemplateId: string | null;
  showBeforeOnMap: boolean;
}
export interface IntersectionWork extends WorkBase {
  kind: 'intersection';
  step: 'conditions' | 'improvements' | 'review';
  center: { lat: number; lng: number } | null;
  conditions: IntersectionConditions | null;
  selectedImprovements: string[];
  crashSummary: CrashSummary | null;
}
export type WorkDraft = StreetWork | IntersectionWork;
export const WORK_DRAFTS_KEY = 'curbwise-work-v1';
const ERROR = 'Your latest work could not be saved in this browser. Keep this page open and retry. Your earlier saved work has not been replaced.';
const READ_ERROR = 'My work could not be read. Your browser data has not been changed.';
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nullableText = (value: unknown) => value === null || typeof value === 'string';

function validDraft(value: unknown): value is WorkDraft {
  if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' ||
    (value.location !== null && (!isPoint(value.location) || !object(value.location) || typeof value.location.address !== 'string')) ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || !isBriefContext(value.briefContext) ||
    (value.archived !== undefined && typeof value.archived !== 'boolean') || (value.followUp !== undefined && typeof value.followUp !== 'string')) return false;
  if (value.kind === 'street') return ['concern', 'street-selected', 'before-selected', 'transform-selected', 'review', 'brief'].includes(String(value.step)) &&
    Array.isArray(value.roadPath) && value.roadPath.every(isPoint) && typeof value.bearing === 'number' && Number.isFinite(value.bearing) &&
    nullableText(value.beforePresetId) && nullableText(value.selectedTemplateId) && typeof value.showBeforeOnMap === 'boolean' &&
    (value.beforeStreet === null || isStreet(value.beforeStreet)) && (value.afterStreet === null || isStreet(value.afterStreet));
  if (value.kind !== 'intersection' || !['conditions', 'improvements', 'review'].includes(String(value.step)) || (value.center !== null && !isPoint(value.center)) ||
    !Array.isArray(value.selectedImprovements) || !value.selectedImprovements.every((id) => typeof id === 'string')) return false;
  const c = value.conditions;
  const summary = value.crashSummary;
  return (c === null || (object(c) && ['T', 'four-way', 'five-way', 'offset'].includes(String(c.shape)) &&
    ['uncontrolled', 'yield', 'two-way-stop', 'all-way-stop', 'signalized', 'roundabout'].includes(String(c.trafficControl)) &&
    ['none', 'unmarked', 'standard-crosswalk', 'high-visibility-crosswalk', 'raised-crosswalk'].includes(String(c.crossingType)) &&
    ['hasCurbRamps', 'hasPedestrianSignal', 'hasTransitStop'].every((key) => typeof c[key] === 'boolean'))) &&
    (summary === null || (object(summary) && ['totalCrashes', 'fatalities', 'severeInjuries', 'pedestrianCrashes', 'cyclistCrashes', 'motoristCrashes', 'radiusMeters'].every((key) => typeof summary[key] === 'number' && Number.isFinite(summary[key]) && (summary[key] as number) >= 0)));
}

function readWork(): Record<string, WorkDraft> {
  const raw = localStorage.getItem(WORK_DRAFTS_KEY);
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!object(parsed) || parsed.version !== 1 || !Array.isArray(parsed.drafts) || !parsed.drafts.every(validDraft)) throw new Error(READ_ERROR);
  return Object.fromEntries(parsed.drafts.map((draft) => [draft.id, draft]));
}

interface WorkDraftsState {
  drafts: Record<string, WorkDraft>;
  pending: Record<string, WorkDraft>;
  retry: () => boolean;
  storageError: string | null;
  load: () => void;
  save: (draft: WorkDraft) => boolean;
  update: (id: string, changes: { archived?: boolean; followUp?: string }) => boolean;
}
export const useWorkDraftsStore = create<WorkDraftsState>()((set, get) => ({
  drafts: {},
  pending: {},
  retry: () => Object.values(get().pending).every((draft) => get().save(draft)),
  storageError: null,
  load: () => {
    try { set({ drafts: readWork(), storageError: Object.keys(get().pending).length ? ERROR : null }); }
    catch { set({ storageError: READ_ERROR }); }
  },
  save: (draft) => {
    try {
      const existing = readWork();
      const previous = existing[draft.id];
      const next = { ...draft, archived: draft.archived ?? get().pending[draft.id]?.archived ?? previous?.archived ?? false, followUp: draft.followUp ?? get().pending[draft.id]?.followUp ?? previous?.followUp ?? '' };
      const serialized = JSON.stringify({ version: 1, drafts: Object.values({ ...existing, [draft.id]: next }) });
      localStorage.setItem(WORK_DRAFTS_KEY, serialized);
      const pending = { ...get().pending };
      delete pending[draft.id];
      set({ pending, drafts: Object.fromEntries((JSON.parse(serialized).drafts as WorkDraft[]).map((item) => [item.id, item])), storageError: Object.keys(pending).length ? ERROR : null });
      return true;
    } catch { set({ pending: { ...get().pending, [draft.id]: draft }, storageError: ERROR }); return false; }
  },
  update: (id, changes) => {
    const draft = Object.prototype.hasOwnProperty.call(get().drafts, id) ? get().drafts[id] : undefined;
    return !!draft && get().save({ ...draft, ...changes, updatedAt: new Date().toISOString() });
  },
}));
