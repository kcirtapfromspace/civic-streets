import { CrashTimeline } from './CrashTimeline';
import { DATA_SOURCES } from './api';
import { useSafetyDataStore } from './safety-data-store';

/** Shared status for both safety filter surfaces. Zero is only shown after a successful query. */
export function CrashCoverageStatus({ zoom }: { zoom: number }) {
  const { enabled, isLoading, error, coverage, sources, crashes, filters, retry } = useSafetyDataStore();
  if (!enabled) return null;
  if (zoom < 11) return <p className="text-xs text-gray-600">Zoom in to see crash data.</p>;
  const hasErrors = !!error || sources.some((source) => source.status === 'error');
  const partial = sources.some((source) => source.status === 'partial');
  return (
    <div className="max-w-xs space-y-2 text-xs leading-5 text-gray-600" aria-live="polite">
      {isLoading ? <p role="status">Loading crash records for this view…</p> : (
        <>
          {coverage === 'unsupported' ? (
            <p>No crash dataset is connected for this area. This does not indicate zero crashes.</p>
          ) : hasErrors ? (
            <p role="alert">Some crash data is unavailable. Results for this view are unknown or incomplete.</p>
          ) : coverage ? (
            <p role="status">{crashes.length
              ? `${crashes.length.toLocaleString()} mapped records returned for this view.`
              : partial ? 'No mapped records returned from the available portion of the data.'
                : 'No mapped records returned for this view and date range.'}</p>
          ) : <p>Crash data has not been checked for this view.</p>}
          {coverage === 'fatal-only' && (
            <p className="text-amber-800">National crash map coverage is not connected for this area. The official NHTSA viewer provides fatal-crash data; FARS does not cover nonfatal crashes.</p>
          )}
          {coverage === 'municipal' && <p>City records only. Surrounding municipalities may not be covered by the selected dataset.</p>}
          {filters.dateRange && <p>Requested dates: {filters.dateRange.start} through {filters.dateRange.end}.</p>}
          {partial && <p className="text-amber-800">Results are incomplete; review the source limits below.</p>}
          {error && <p>{error}</p>}
          {sources.map((result) => {
            const source = DATA_SOURCES.find((item) => item.id === result.sourceId);
            if (!source) return null;
            return (
              <div key={source.id} className="border-t border-gray-100 pt-2">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline">{source.name}</a>
                <p>{result.history ? 'One-year archive · monthly imports' : source.dateRange}</p>
                {result.history && <CrashTimeline history={result.history} city={source.city} />}
                <p>{source.coverageNote}</p>
                {result.status === 'error' && <p className="text-red-700">Source unavailable: {result.error}</p>}
                {result.warnings.map((warning) => <p key={warning} className="text-amber-800">{warning}</p>)}
              </div>
            );
          })}
          {hasErrors && <button type="button" onClick={() => void retry()} className="font-medium text-blue-700 underline">Retry crash data</button>}
        </>
      )}
    </div>
  );
}
