import { useEffect, useId, useRef, useState } from 'react';
import { generateObservationPDF } from '@/features/export';
import type { ObservationSnapshot } from '@/lib/types';
import type { MockHotspot } from './mock-data';
import { observationBriefContext, saveObservationBrief } from './observation-brief-store';
import { BriefPreview } from '@/features/export/BriefPreview';

/** A useful handoff even when the concern does not call for a street redesign. */
export function ObservationBrief({ hotspot, source }: {
  hotspot: MockHotspot;
  source: ObservationSnapshot['source'];
}) {
  const fieldId = useId();
  const [context, setContext] = useState(() => observationBriefContext(hotspot, source));
  const [saveError, setSaveError] = useState<string | null>(null);
  const desiredOutcome = context.desiredOutcome;
  const requestedNextStep = context.requestedNextStep;
  const updateNotes = (field: 'desiredOutcome' | 'requestedNextStep', value: string) => {
    const next = { ...context, [field]: value, revisedAt: new Date().toISOString() };
    setContext(next);
    setSaveError(saveObservationBrief(hotspot.id, next));
    clearDownload();
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const clearDownload = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setDownloadUrl(null);
  };

  const prepareBrief = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setError(null);
    clearDownload();
    try {
      const blob = await generateObservationPDF({ ...context, desiredOutcome: desiredOutcome.trim(), requestedNextStep: requestedNextStep.trim() });
      if (!mountedRef.current) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setDownloadUrl(url);
    } catch {
      if (mountedRef.current) setError('The brief could not be prepared. Your notes are still here. Please try again.');
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  return (
    <details className="border-t border-civic-line">
      <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-medium">
        Make a brief from this observation
      </summary>
      <div className="space-y-4 px-5 pb-5 text-sm">
        <p className="leading-6 text-civic-muted">Bring the location, notes, and available photos to a conversation. You can prepare a brief without drawing a street concept.</p>
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          <div>
            <label htmlFor={`${fieldId}-outcome`} className="block font-medium">What would you like to improve? <span className="font-normal text-civic-muted">(optional)</span></label>
            <textarea id={`${fieldId}-outcome`} rows={2} maxLength={1000} value={desiredOutcome}
              onChange={(event) => { updateNotes('desiredOutcome', event.target.value); }}
              className="mt-2 w-full rounded border border-civic-line p-3 focus-visible:outline-2 focus-visible:outline-civic-ink" />
          </div>
          <div>
            <label htmlFor={`${fieldId}-next`} className="block font-medium">What are you asking for? <span className="font-normal text-civic-muted">(optional)</span></label>
            <p id={`${fieldId}-hint`} className="mt-1 text-xs text-civic-muted">For example, a site visit or feedback from your neighborhood group.</p>
            <textarea id={`${fieldId}-next`} aria-describedby={`${fieldId}-hint`} rows={2} maxLength={1000} value={requestedNextStep}
              onChange={(event) => { updateNotes('requestedNextStep', event.target.value); }}
              className="mt-2 w-full rounded border border-civic-line p-3 focus-visible:outline-2 focus-visible:outline-civic-ink" />
          </div>
        </fieldset>
        <p role="status" className="text-xs text-civic-muted">{saveError || 'Brief notes are saved in this browser as you edit. They are not published.'}</p>
        {!requestedNextStep.trim() && <p className="text-sm text-civic-muted">Before sharing, add a specific request so the reader knows how to respond. You can still download an unfinished brief.</p>}
        <details><summary className="min-h-11 cursor-pointer py-3 font-medium">Read the brief on this page</summary><BriefPreview context={context} /></details>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {downloadUrl ? (
          <div>
            <p role="status" className="mb-2 text-xs text-civic-muted">Your discussion brief is ready.</p>
            <a href={downloadUrl} download="observation-discussion-brief.pdf" className="inline-flex min-h-11 items-center rounded bg-civic-ink px-4 font-medium text-white">Download discussion brief</a>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => void prepareBrief()} className="min-h-11 rounded border border-civic-line px-4 font-medium hover:bg-civic-wash disabled:opacity-60">
            {busy ? 'Preparing brief…' : 'Prepare discussion brief'}
          </button>
        )}
        <p className="text-xs leading-5 text-civic-muted">Downloads a PDF for you to share. Nothing is sent automatically.</p>
      </div>
    </details>
  );
}
