# Observation capture and credibility fixes

September 27, 2026. Implemented locally; not deployed.

## Result

- The landing page and map lead with capturing problematic places: location, issue type, notes, and photos. Street concepts are secondary. Government lead collection no longer appears in this journey; existing account and billing routes remain available.
- The capture form saves an observation after two steps, with extra details optional. It does not divert residents to 311. City links and representative drafts are closed optional follow-ups after the observation evidence on its detail page. Routing rectangles remain suggestions; residents must confirm the responsible city.
- Report detail no longer checks for a Curbwise government contract or queues sales outreach before offering city reporting or representative drafts. Public portal links require the resident to finish submission on the city website. No automatic transfer, receipt, tracking, or repair is claimed.
- Successful saves link to the observation and distinguish public map records from browser-only demo records. The link uses client-side navigation so local records survive opening their detail page.
- Live report lookups no longer fall back to hardcoded examples. Detail, feed, and representative-context lookup errors offer retry; loading and missing reports cannot silently populate a representative draft with unrelated context.
- Demo mode is labeled throughout the app and on feed cards. Local reports disappear on reload. Their prepared photo bytes remain available after the form releases temporary preview URLs; photo read failure leaves no partially saved local record.
- Report detail no longer displays fictional authors, comments, or linked designs. Discussion and linked designs are explicitly unavailable until a real persistence workflow is implemented. The timeline is labeled as Curbwise community status, not evidence of city action.
- Fictional example reports cannot seed representative messages, including through a direct draft URL. Local vote counts are excluded from drafts. Generated text does not claim community consensus, verified conditions, or comprehensive engineering/accessibility approval.
- Missing voting sessions and invalid report IDs fail explicitly. Failed detail votes show a retry message and reset the optimistic display.

## Earlier technical verification

Node 24.21.0 was used. `npm run check` passed:

- 15 coverage-policy tests.
- 1,159 application tests in 95 files, using the existing isolated fixtures and network guard.
- Strict coverage standards for all 214 production files: 99.31% lines, 98.86% statements, 99.70% functions, 96.83% branches.
- Backend TypeScript and production build.

`npm run coverage:ratchet` tightened the existing baseline only after the complete passing coverage run. Thresholds and source/test discovery exclusions were not changed. Changed source/test files passed scoped ESLint; `git diff --check` passed. The production build retains an existing CSS warning about a Google Fonts import appearing after other rules.

Browser smoke checks used a local preview with the backend and analytics disabled. The landing, map, feed, and example detail were checked for truthful labels and actions. No real community record, city request, or external message was submitted. Automated tests cover the live-mode behavior, failure/retry paths, optional city links, and representative-draft safeguards. See [UX changes](ux-polish.md) for the latest capture flow verification.

## Remaining boundaries

These changes do not establish city partnerships, user traction, automatic 311 integration, persistent community discussion, or approved street designs. Public portal URLs were checked against official city pages, but intake forms and service boundaries can change. Representative drafts still require review and manual sending. Release deployment and a real resident pilot remain separate work.
