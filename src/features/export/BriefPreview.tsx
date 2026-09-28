import type { DiscussionBriefContext } from '@/lib/types';

/** Semantic HTML counterpart for people who prefer reading without a PDF viewer. */
export function BriefPreview({ context, title = 'Discussion brief', location }: {
  context: DiscussionBriefContext; title?: string; location?: { address?: string; lat?: number; lng?: number };
}) {
  const observation = context.observation;
  const place = observation ?? location;
  return <article aria-label="Readable discussion brief" className="space-y-4 rounded border border-civic-line bg-white p-4 text-sm text-civic-ink print:border-0">
    <header>
      <h2 className="text-lg font-semibold">{title}</h2>
      {place && <p>{place.address}{typeof place.lat === 'number' && typeof place.lng === 'number' ? ` · ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` : ''}</p>}
      {context.briefId && <p className="text-xs text-civic-muted">Brief: {context.briefId}{context.revisedAt ? ` · Revision: ${context.revisedAt}` : ''}</p>}
    </header>
    <dl className="space-y-3">
      {([['The concern', context.concern], ['What we would like to improve', context.desiredOutcome], ['What we are asking for', context.requestedNextStep]]).map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap">{value.trim() || 'Not provided — add this before sharing if the reader needs it.'}</dd></div>)}
    </dl>
    {observation && <section aria-label="Original observation"><h3 className="font-semibold">Original observation</h3><p className="whitespace-pre-wrap">{observation.description || observation.title}</p><p className="text-xs text-civic-muted">{observation.source === 'community' ? 'Published community observation. Snapshot retained; the source may have changed.' : 'Unpublished or example observation. Not a verified community submission.'}</p>
      {context.sourceUrl && observation.source === 'community' && <a className="underline" href={context.sourceUrl}>Open source observation</a>}
      {observation.photoUrls.map((url, i) => <figure key={`${i}-${url}`} className="mt-3"><img src={url} alt={`Observation photo ${i + 1}; details are described in the original observation`} className="max-h-80 max-w-full object-contain" /><figcaption>Observation photo {i + 1}; capture date not verified.</figcaption></figure>)}
    </section>}
    {context.supportingEvidence && <section aria-label="Supporting evidence"><h3 className="font-semibold">{context.supportingEvidence.title}</h3><p>{context.supportingEvidence.summary}</p><p className="text-xs text-civic-muted">Snapshot: {context.supportingEvidence.capturedAt}</p><ul className="list-disc pl-5">{context.supportingEvidence.details.map((detail, i) => <li key={i}>{detail}</li>)}</ul><ul>{context.supportingEvidence.sources.map((source, i) => <li key={i}><a className="underline" href={source.url}>{source.label}</a></li>)}</ul></section>}
    <p className="text-xs leading-5 text-civic-muted">Discussion material. Statements and location are supplied by the author; this brief does not establish engineering approval or submit a request to an agency.</p>
  </article>;
}
