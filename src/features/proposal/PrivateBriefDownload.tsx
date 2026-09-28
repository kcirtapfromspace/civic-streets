import { useEffect, useRef, useState } from 'react';
import type { DiscussionBriefContext, StreetLocation } from '@/lib/types';

/** Retain a reviewed download until its content changes or the reader leaves. */
export function PrivateBriefDownload({ context, name, location, filename = 'discussion-brief.pdf' }: {
  context: DiscussionBriefContext;
  name: string;
  location?: StreetLocation | null;
  filename?: string;
}) {
  const signature = JSON.stringify({ context, name, location });
  const generation = useRef(0);
  const inFlight = useRef<string | null>(null);
  const retainedUrl = useRef<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{ signature: string; url: string } | null>(null);
  const [error, setError] = useState<{ signature: string; message: string } | null>(null);
  useEffect(() => () => {
    generation.current += 1;
    inFlight.current = null;
    if (retainedUrl.current) { URL.revokeObjectURL(retainedUrl.current); retainedUrl.current = null; }
  }, [signature]);
  const ready = prepared?.signature === signature ? prepared : null;
  const busy = working === signature;
  const complete = !!context.concern.trim() && !!context.requestedNextStep.trim();
  const download = async () => {
    if (inFlight.current === signature) return;
    inFlight.current = signature;
    const request = ++generation.current;
    setWorking(signature);
    setError(null);
    try {
      const { generateObservationPDF } = await import('@/features/export');
      const blob = await generateObservationPDF(context, { ...(location ?? {}), name });
      if (request !== generation.current) return;
      const url = URL.createObjectURL(blob);
      if (retainedUrl.current) URL.revokeObjectURL(retainedUrl.current);
      retainedUrl.current = url;
      setPrepared({ signature, url });
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    } catch {
      if (request === generation.current) setError({ signature, message: 'The brief could not be downloaded. Your notes are still here. Try again.' });
    } finally {
      if (request === generation.current) { inFlight.current = null; setWorking(null); }
    }
  };
  return <div className="space-y-2">
    {error?.signature === signature && <p role="alert" className="text-sm text-red-800">{error.message}</p>}
    <button disabled={busy || !complete} onClick={() => void download()} className="min-h-11 w-full rounded-sm bg-[#172126] px-4 py-2 text-sm font-medium text-white disabled:bg-[#d8dddf] disabled:text-[#59646a]">{busy ? 'Preparing brief…' : 'Download brief PDF'}</button>
    {!complete && <p className="text-xs text-[#59646a]">Add the concern and requested next step before downloading.</p>}
    {ready && <p role="status" className="text-sm">Brief prepared; nothing has been sent. <a href={ready.url} download={filename} className="inline-flex min-h-11 items-center underline">Download PDF again</a></p>}
  </div>;
}
