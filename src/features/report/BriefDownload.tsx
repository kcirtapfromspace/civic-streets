import { useEffect, useRef, useState } from 'react';
import { generateObservationPDF, generatePDF } from '@/features/export';
import type { DiscussionBriefContext, StreetSegment } from '@/lib/types';
import { validateStreet, loadStandards } from '@/lib/standards/validator';

/** A mailto URL cannot carry a file. Prepare an actual download for manual attachment. */
export function BriefDownload({ context, street, beforeStreet = null }: {
  context?: DiscussionBriefContext; street?: StreetSegment; beforeStreet?: StreetSegment | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const currentUrl = useRef<string | null>(null);
  useEffect(() => {
    generation.current += 1;
    return () => { generation.current += 1; if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); };
  }, []);
  async function prepare() {
    if (pending.current) return;
    pending.current = true;
    const request = generation.current;
    setBusy(true); setError(null);
    try {
      const blob = street ? await generatePDF(street, beforeStreet, validateStreet(street, loadStandards()), context) : await generateObservationPDF(context!);
      if (request !== generation.current) return;
      const next = URL.createObjectURL(blob);
      currentUrl.current = next;
      setUrl(next);
    } catch {
      if (request === generation.current) setError('The PDF could not be prepared. Your message is still here; retry or send the text without an attachment.');
    } finally {
      pending.current = false;
      if (request === generation.current) setBusy(false);
    }
  }
  if (!context && !street) return <p className="text-sm text-civic-muted">No brief is linked to this message. Open your saved concept to download its PDF.</p>;
  return <section aria-label="Download for manual attachment" className="space-y-2 rounded border border-civic-line p-3">
    <h4 className="font-semibold">Optional discussion brief</h4>
    <p className="text-sm text-civic-muted">Download the file, then attach it yourself in your email app. Opening an email draft does not attach a file.</p>
    {url ? <a className="inline-flex min-h-11 items-center underline" href={url} download="curbwise-discussion-brief.pdf">Download PDF to attach manually</a> : <button type="button" disabled={busy} onClick={() => void prepare()} className="min-h-11 rounded border border-civic-line px-4 disabled:opacity-60">{busy ? 'Preparing PDF…' : 'Prepare PDF for download'}</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
