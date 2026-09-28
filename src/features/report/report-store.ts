// Local recipient drafts retain the author's edits across reloads and context changes.
import { create } from 'zustand';
import { isBriefContext } from '@/stores/saved-proposals-store';
import type { DiscussionBriefContext, RepInfo } from '@/lib/types';
export type ReportStep = 1 | 2 | 3 | 4;
interface Draft {
  step: ReportStep;
  designId: string | null;
  hotspotId: string | null;
  address: string;
  selectedReps: RepInfo[];
  subject: string;
  body: string;
  includePdf: boolean;
  messageInitialized: boolean;
  briefContext?: DiscussionBriefContext;
}
export interface ReportState extends Draft {
  saveError: string | null;
  setStep: (step: ReportStep) => void;
  setContext: (designId: string | null, hotspotId: string | null, address: string) => void;
  openContext: (designId: string | null, hotspotId: string | null, address: string, briefContext?: DiscussionBriefContext) => void;
  selectRep: (rep: RepInfo) => void;
  deselectRep: (repName: string) => void;
  setSubject: (subject: string) => void;
  setBody: (body: string) => void;
  initializeMessage: (subject: string, body: string) => void;
  togglePdf: () => void;
  reset: () => void;
}
const initialState: Draft = { step: 1, designId: null, hotspotId: null, address: '', selectedReps: [], subject: '', body: '', includePdf: false, messageInitialized: false };
const STORAGE_KEY = 'curbwise-recipient-drafts-v1';
const draftKey = (designId: string | null, hotspotId: string | null) => JSON.stringify([designId, hotspotId]);
function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Draft;
  return [1, 2, 3, 4].includes(draft.step) && typeof draft.address === 'string' && typeof draft.subject === 'string' && typeof draft.body === 'string' &&
    Array.isArray(draft.selectedReps) && draft.selectedReps.every((rep) => rep && typeof rep.name === 'string' && typeof rep.title === 'string' && (rep.email === undefined || typeof rep.email === 'string')) &&
    (draft.briefContext === undefined || isBriefContext(draft.briefContext));
}
function readDrafts(): Record<string, Draft> {
  const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every(validDraft)) throw new Error('Invalid saved drafts');
  return parsed as Record<string, Draft>;
}
export function readReportDraft(designId: string | null, hotspotId: string | null): Draft | null {
  try {
    const value = readDrafts()[draftKey(designId, hotspotId)];
    return value ? { ...value, designId, hotspotId, includePdf: value.includePdf === true, messageInitialized: value.messageInitialized === true } : null;
  } catch { return null; }
}
export const useReportStore = create<ReportState>((set, get) => ({
  ...initialState, saveError: null,
  setStep: (step) => set({ step }),
  setContext: (designId, hotspotId, address) => set({ designId, hotspotId, address }),
  openContext: (designId, hotspotId, address, briefContext) => {
    const current = get();
    const sameContext = current.designId === designId && current.hotspotId === hotspotId;
    const hasWork = Boolean(current.address || current.body || current.selectedReps.length || current.step !== 1);
    const draft = sameContext && hasWork ? current : readReportDraft(designId, hotspotId) ?? initialState;
    set({ ...draft, designId, hotspotId, address: draft.address || address, briefContext: briefContext ?? draft.briefContext });
  },
  selectRep: (rep) => set((state) => state.selectedReps.some((r) => r.name === rep.name) ? state : { selectedReps: [...state.selectedReps, rep] }),
  deselectRep: (repName) => set((state) => ({ selectedReps: state.selectedReps.filter((r) => r.name !== repName) })),
  setSubject: (subject) => set({ subject, messageInitialized: true }),
  setBody: (body) => set({ body, messageInitialized: true }),
  initializeMessage: (subject, body) => {
    if (!get().messageInitialized) set({ subject: get().subject || subject, body: get().body || body, messageInitialized: true });
  },
  togglePdf: () => set((state) => ({ includePdf: !state.includePdf })),
  reset: () => set({ ...initialState, briefContext: undefined, saveError: null }),
}));
useReportStore.subscribe((state, previous) => {
  if ((Object.keys(initialState) as Array<keyof Draft>).every((key) => state[key] === previous[key]) && state.briefContext === previous.briefContext) return;
  const { step, designId, hotspotId, address, selectedReps, subject, body, includePdf, messageInitialized, briefContext } = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readDrafts(), [draftKey(designId, hotspotId)]: { step, designId, hotspotId, address, selectedReps, subject, body, includePdf, messageInitialized, briefContext } }));
    if (state.saveError) useReportStore.setState({ saveError: null });
  } catch {
    if (!state.saveError) useReportStore.setState({ saveError: 'This recipient draft could not be saved in this browser. Keep this page open and copy your message before leaving.' });
  }
});
