import type { CrashHistory } from '../../../shared/crash-history';
import { monthRange } from '../../../shared/crash-history';
import { useSafetyDataStore } from './safety-data-store';

/** City-wide totals are deliberately separate from capped viewport point counts. */
export function CrashTimeline({ history, city }: { history: CrashHistory; city: string }) {
  const setDateRange = useSafetyDataStore(s => s.setDateRange);
  const retry = useSafetyDataStore(s => s.retry);
  const clearDateRange = useSafetyDataStore(s => s.clearDateRange);
  const selected = useSafetyDataStore(s => s.filters.dateRange);
  const max = Math.max(1, ...history.months.map(item => item.count ?? 0));
  const newestMonth = history.latestRecord?.slice(0, 7);
  return (
    <section className="my-3 border-y border-slate-200 py-3" aria-label={`${city} monthly crash history`}>
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-semibold text-slate-900">{city} · 12 months</h4>
        <button type="button" onClick={clearDateRange} className="text-blue-700 underline">All months</button>
      </div>
      <p className="text-[10px] text-slate-500">City-wide mapped crashes · all modes and severities</p>
      <div className="mt-3 flex h-24 items-end gap-1" role="group" aria-label="Select a month to filter the map">
        {history.months.map(item => {
          const available = item.count !== null;
          const incomplete = !available || item.status !== 'ready' || !newestMonth || item.month >= newestMonth;
          const label = `${item.month}: ${item.count !== null ? `${item.count.toLocaleString()} mapped crashes` : 'not imported'}${incomplete ? ' · incomplete period' : ''}`;
          return (
            <button key={item.month} type="button" disabled={!available}
              aria-label={label} title={label} aria-pressed={selected?.start === `${item.month}-01`}
              onClick={() => { const range = monthRange(item.month); setDateRange(range.start, range.end); }}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait">
              <span aria-hidden="true" className={`block w-full rounded-t-sm border ${incomplete ? 'border-dashed border-amber-600 bg-amber-100' : 'border-slate-600 bg-slate-600'} group-aria-pressed:border-blue-600 group-aria-pressed:bg-blue-600`}
                style={{ height: `${Math.max(5, ((item.count ?? 0) / max) * 76)}px` }} />
              <span aria-hidden="true" className="mt-1 text-[9px] tabular-nums text-slate-500">{item.month.slice(5)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">Select a bar to filter the map. Amber marks incomplete periods; empty recent months do not establish zero crashes.</p>
      <button type="button" onClick={() => void retry()} className="font-medium text-blue-700 underline">Refresh crash data</button>
      <p>Latest record: {history.latestRecord ?? 'not available'}.</p>
      <p>Last completed import: {history.lastSuccess ? new Date(history.lastSuccess).toISOString().slice(0, 10) : 'pending'}.</p>
    </section>
  );
}
