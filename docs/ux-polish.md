# Map startup and observation UX

## Behavior

- The map starts with a usable Denver view, then tries a city-level IP estimate from GeoJS once per app session. The lookup stops after four seconds; missing cities, invalid coordinates, coarse estimates, network errors, and rate limits keep the fallback. Searching, panning, zooming, choosing a pin, or reopening a proposal takes precedence over a late response.
- The estimate is labeled approximate. It never selects a report location or determines city jurisdiction. Curbwise retains the city label and approximate coordinates in memory only; the returned IP and ASN are not retained. The browser request omits credentials and referrer. Provider details are in [public data sources](public-data-sources.md).
- Search and map clicks lead with **Mark a problem**. The capture flow saves after location/photo and issue selection; a third details screen is optional. **Other** supports concerns outside the named issue types without an extra subtype selection. Street concepts remain a secondary action. Drawing and map layers stay behind compact controls.
- Completed proposals have separate Save draft and Download PDF actions. Saved drafts use versioned browser storage and reopen after reload; this is not account/cloud synchronization. Storage failures keep the work open. Clearing browser data removes saved drafts.
- Unfinished work remains available in the current session and receives reload protection. Opening a different saved draft requires an explicit choice before replacing unfinished work. Detailed editor changes return to the proposal review.
- Observations use a focus-contained dialog. City portals do not interrupt capture; optional follow-up links live on saved observation details. Accidental backdrop clicks or Escape do not discard the form or trigger workspace shortcuts; the form's Cancel action remains available when it is not submitting.

## Visual direction

Simple white and charcoal surfaces, compact sans-serif type, restrained accents, and one obvious next action. No looping video, serif marketing treatment, fake notification action, or decorative dashboard cards. The landing leads with recording a location and what was noticed. An original illustrative Broadway concept is available in a closed optional section, with official planning context and unresolved assumptions. It is not a street survey or a city-approved plan.

## Verification

Fixture-backed tests cover IP success/failure/timeout and stale responses, durable draft reload/reopen, malformed or unavailable storage, save/export retries, keyboard focus, and proposal entry from pins/search. Manual browser checks cover city startup, desktop/mobile layout, keyboard skip navigation, and save/reload/reopen. Use Node 24 and `npm run check` for the complete application, coverage, backend type, and production-build gates.

### Completed check, September 27, 2026

`npm run check` passed on Node 24: 1,296 application tests in 99 files, 15 policy tests, strict coverage for all 218 production modules, backend type checking, and production build. `coverage:ratchet` tightened the baseline after that complete run; `coverage:strict` passed again. Scoped lint passed for changed files. Existing bundle-size advisories remain.

The browser pass confirmed approximate city startup, phone layouts, keyboard skip navigation, save/reload/reopen, generated PDF availability through the retained download link, and navigation away from an active map with saved proposals and crash data. The embedded browser did not expose a download-completion event, so native file-save completion was not independently confirmed. Actual PDF content is checked by the existing real-renderer tests. All changes are local; no deployment or city submission was performed.

### Observation capture revision, September 27, 2026

Capture now leads the landing and map actions. Residents can save after two steps, choose Other for uncategorized problems, and open extra details or category assistance only when needed. The saved observation shows location, notes, photos, issue group/type, blocking answer, and record-creation time. City portals and representative drafts are closed optional follow-ups. Geographic capture limits remain the three existing pilot areas.

`npm run check` passed on Node 24: 1,302 app tests in 100 files, 15 policy tests, strict coverage for all 218 production modules, backend type checking, and production build. The baseline was ratcheted after that complete run and strict coverage rechecked. Scoped ESLint and diff checks passed. Browser QA at 390px confirmed capture, browser-session save, reopening with metadata intact, closed optional follow-up, and the repaired demo Account page. No live observation or city request was submitted.

### Reused product media

The landing pairs the capture explanation with the existing Humboldt Park satellite screenshot and 46-second silent walkthrough. Playback uses native controls and starts only when requested; the video has `preload="none"`, no autoplay, and no loop. Its caption identifies the earlier interface and distinguishes crash layers from community observations. The existing recording and screenshot are reused without generating new imagery or representing the demonstration as current user activity. A compatible H.264 copy of the same recording is offered first, retaining the original WebM as fallback; the original WebM crashed the embedded browser during playback QA.

After media reuse, the complete Node 24 check passed again (1,302 tests, strict coverage, backend types, production build). Scoped lint passed. Desktop and phone layouts were inspected, and the H.264 recording played through 25 seconds before being paused. Native controls, no autoplay, and the earlier-interface caption were verified.
