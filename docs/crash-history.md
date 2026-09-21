# One-year crash archive

## Scope

Convex stores mapped crash records for Chicago, Denver, and NYC for the current UTC calendar month and the preceding eleven months. This is a rolling twelve-month window, including an incomplete current month, rather than twelve complete historical months. The archive records reported occurrences, not exposure-adjusted crash risk or a complete census of crashes.

The backend owns ingestion. Browser clients query the archive when `VITE_CONVEX_URL` is configured; the existing direct provider adapters remain available in an unconfigured local environment. Backend failures never silently fall back to capped municipal queries. National FARS coverage remains unconnected.

## Storage and synchronization

- `crashMonths`: one partition per city/month, with active generation, mapped count, known fatalities, skipped rows, latest mapped occurrence, successful import time, and current import state.
- `crashRecords`: normalized, public incident data indexed by generation/incident identifier and generation/latitude. No names, vehicle identifiers, or raw source payloads are retained.
- Each refresh writes an isolated generation in 200-row transactions. Only a fully fetched month is published. A failed refresh keeps the previous completed generation readable; staged rows are removed.
- Source incident IDs deduplicate records within a generation. Multiple Denver involved-party rows merge road-user modes and take maximum incident casualty counts instead of summing the same incident repeatedly.
- Replacing a completed month incorporates provider corrections and removals. Old generations are cleaned in 250-row batches. This is not a revision-history store: it preserves crash occurrence history, not every version of every publisher record.
- The daily Convex cron starts at 06:30 UTC. Current and previous months refresh daily; older months refresh every 30 days. Missing months backfill newest first. One active month per city, at least one second between pages. Each completed or failed month schedules the next eligible partition; failed months wait until the following day before retrying.
- Imports are bounded to one hour and 100,000 raw rows per month; exceeding either fails the generation rather than publishing truncated totals. Publisher requests time out after 20 seconds. Existing data remains available.
- Partitions outside the twelve-month window are removed. No community data is changed.

## Map and timeline

Viewport queries read only active generations. Latitude indexes narrow the search, followed by longitude/date filtering. Each request scans at most 5,000 records plus a sentinel; results are explicitly marked partial when capped. Monthly timeline totals are calculated during import and remain city-wide, independent of map bounds or mode/severity toggles. They count mapped incidents, not all source rows.

The accessible monthly bars select a map date range. Missing imports and incomplete recent periods use an amber treatment. Each source displays its latest mapped record and last successful import separately. A recent successful import cannot make an old publisher dataset current. Source lag over fourteen days, failed refreshes, pending months, skipped rows, and viewport caps are surfaced as warnings. Imported zero-count months after the latest available record are not evidence of zero recent crashes.

## Deployment and operation

These tables and indexes are additive; no existing table requires a backfill or schema migration. Deploy the backend before publishing the frontend. The live app uses `chatty-puffin-875`; default `convex deploy` targets a separate production deployment and must not be used for this cutover.

After backend deployment, start ingestion with:

```sh
npx convex run crashArchive:startDaily '{}'
```

Inspect `crashMonths` through the Convex dashboard or CLI for partition progress. `startDaily` is internal: anonymous clients cannot trigger imports or write archive records. Re-running it while work is active is safe. On rollback, restore the prior frontend while leaving these additive tables intact; do not delete community records or fabricate imported records.

## Verification

Tests use isolated Convex databases and fixture-backed publisher responses. They exercise atomic publication, duplicate incident merging, corrected/retracted monthly records, failure preservation, stale deliveries, expired imports, bounded cleanup, one-year retention, map bounds/date validation, read caps, source parsing, source pagination, missing data, and timeline selection. Real publisher smoke checks are separate from the automated test suite.
