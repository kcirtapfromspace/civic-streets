import { useEffect, useRef, useState } from 'react';
import { requestReportAssistance } from '@/lib/api/report-assistance';
import { getIssueTypeConfig } from '@/lib/config/issue-types';
import { ASSISTANCE_UNAVAILABLE, FOLLOW_UPS, type AssistanceInput, type AssistanceResult } from '../../../shared/report-assistance';

interface Props {
  input: AssistanceInput;
  onApply: (issueType: string) => void;
  onResult: (id: AssistanceResult['id']) => void;
}

/** Parent keys this panel by input, discarding responses for edited or closed drafts. */
export function ReportAssistance({ input, onApply, onResult }: Props) {
  const [result, setResult] = useState<AssistanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function suggest() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true); setError(null);
    try {
      const next = await requestReportAssistance(input);
      if (!active.current) return;
      setResult(next); onResult(next.id);
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : ASSISTANCE_UNAVAILABLE);
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }

  const suggestion = result?.suggestedIssueType ? getIssueTypeConfig(result.suggestedIssueType) : undefined;
  return (
    <section aria-label="Report suggestions" className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-800">A little help with your report</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Get an issue suggestion, useful questions, and possible related reports. You choose what to use.
          </p>
        </div>
        {!result && <button type="button" onClick={suggest} disabled={loading || input.description.trim().length < 10}
          className="shrink-0 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600">
          {loading ? 'Checking…' : 'Suggest'}
        </button>}
      </div>
      {!result && <p className="text-[11px] leading-relaxed text-gray-500">Selecting Suggest sends your description and nearby public report text to TypeSafe AI. Photos are not analyzed. Avoid personal details.</p>}
      <div aria-live="polite" aria-busy={loading}>
        {error && <p role="status" className="text-xs text-gray-700">{error}</p>}
        {result && <div className="space-y-3">
          {suggestion ? <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-700">Suggested issue: <strong>{suggestion.label}</strong></p>
            <button type="button" disabled={applied} onClick={() => { onApply(suggestion.slug); setApplied(true); }}
              className="rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white disabled:bg-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              {applied ? 'Applied' : 'Use suggestion'}
            </button>
          </div> : <p className="text-xs text-gray-700">No clear issue suggestion yet. Choose the type that best fits what you saw.</p>}
          {result.followUps.length > 0 && <div>
            <p className="text-xs font-medium text-gray-800">Details you could add</p>
            <ul className="mt-1 list-disc pl-4 space-y-1 text-xs text-gray-600">{result.followUps.map((id) => <li key={id}>{FOLLOW_UPS[id]}</li>)}</ul>
          </div>}
          {result.relatedReports.length > 0 ? <div>
            <p className="text-xs font-medium text-gray-800">Possibly related nearby</p>
            <ul className="mt-1 space-y-1">{result.relatedReports.map((report) => <li key={report.id}>
              <a href={`/hotspot/${report.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline underline-offset-2">{report.title}<span className="sr-only"> (opens in a new tab)</span></a>
            </li>)}</ul>
            <p className="mt-1 text-[11px] text-gray-500">Review the report before adding your support. Your draft stays here.</p>
          </div> : <p className="text-xs text-gray-500">No strong matches among the nearby reports checked.</p>}
        </div>}
      </div>
    </section>
  );
}
