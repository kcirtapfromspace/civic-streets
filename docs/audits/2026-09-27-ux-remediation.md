**Curbwise UX implementation · September 27, 2026**

The audit has been turned into application changes across three agent workstreams: durable private work, recipient handoffs and artifacts, and editor accessibility and continuity. Integration work added visible tradeoffs, sourced evidence, early reporting eligibility, map failure recovery, and a global return to My work.

The product now supports a small private request without publishing or drawing a street. Street and intersection concepts have a durable local home, and the handoff preserves the resident’s words. These changes establish a stronger working foundation; they do not establish that the product meets the highest standard of real-world usefulness. Resident and recipient research, assistive-technology testing, and production measurements remain necessary.

| Audit finding | Implemented result | Remaining boundary |
| --- | --- | --- |
| 1. Intersection completion | Save and finish persists the concept; reopen, revise and download a brief with conditions and selected ideas. | Saved locally, without city submission or account sync. |
| 2. Lost early work | Autosave partial concerns, all concept stages and standalone editor work. Quota/corruption errors retain editable work; pending writes can retry. | Clearing browser data still removes drafts. Demo public observations remain explicitly session-only. |
| 3. Lost email context | Carry original notes, desired outcome and specific ask into the message. Preserve edited or deliberately cleared email text across reload. | Email drafts and observation notes resume through their source routes rather than a combined communications inbox. |
| 4. Inconsistent export access | Basic PDFs are free in resident workflows. Standalone editing offers shared brief review and preserves its own work identity. | Premium branded/agency services remain separate. A raw layout can still be exported before purpose fields are filled. |
| 5. Overstated checks | Explicit pending, complete and failed checks; limited dimension language in editor, cards and PDF. | Width checks do not establish complete accessibility, engineering feasibility or approval. |
| 6. Core accessibility defects | Independent native element controls; static diagrams have no fake actions; named intersection buttons, selected states, contrast and larger controls. Fixed a newly reproduced modal typing/focus bug. | Automated and sampled browser checks are not WCAG certification or a screen-reader study. |
| 7. Broken design links | Query and validate the referenced design; exact loading, unavailable and retry states. Never display a different in-memory design for that URL. | Connected account/access behavior still needs a staged production smoke test. |
| 8. Phantom attachment | Prepare a real downloadable PDF and explicitly instruct manual attachment. Keep the message on failure. | Curbwise cannot attach through mailto or verify that an email was sent. |
| 9. Hidden tradeoffs | Compare actual fitted allocations before choosing, including each narrowing sidewalk, removed space and fitting limits. Show the resident’s stated priority. | A retained multi-option comparison workspace and explicit prioritization model remain future work. |
| 10. Private small request | New private concern from My work; typed place without invented coordinates; brief without geometry or public posting. | Adding a verified mapped location to an existing text-only draft is not yet a dedicated workflow. |
| 11. Late photo rejection | Show and enforce the current reporter’s requirement before advancing; loading/unavailable sessions are explicit; private concern remains available. | Public-report photo rules still apply on the backend. Photos selected for a public report are not silently copied to the private concern. |
| 12. Unscoped crash evidence | Optional frozen snapshot with source links, date/filter scope, coverage limits and capture time. Great-circle distance replaces degree approximation. | Viewport and source boundaries can limit records; the snapshot explicitly states this. No safety predictions are made. |
| 13. Artifact quality | Repeated PDF running headers/footers; source/revision metadata where available; supported observation photos; optional evidence; semantic HTML brief. | PDFs remain untagged. The HTML counterpart covers the narrative and evidence, not every visual/technical element of the PDF. |
| 14. Mobile/coherence | Editor sections for street view, elements and checks; corrected height behavior and touch controls; original civic styling retained. | Older entry forms and broader visual consolidation remain incremental work. |
| 15. Return and follow-up | Global My work, recoverable archive/restore, local follow-up notes, clear privacy/storage scope. | No verified agency receipt, response tracking, collaborative review or public correction/withdrawal workflow is claimed. |
| 16. Map/provider recovery | Demo search reports missing configuration; asynchronous tile failures surface; typed-place recovery works without a map. | Live provider availability and field performance still need production monitoring. |

**Verification.** The final Node 24 `npm run check` passed: 15 policy tests, 1,579 application tests in 117 files, strict coverage across all 235 production files, backend types, and the production build. Scoped ESLint passed for all 105 changed or new source and test files, and `git diff --check` passed. See the [complete check log](2026-09-27-implementation-evidence/check.log). No coverage thresholds or exclusions were weakened; existing unrelated workspace changes were preserved. Vite still reports large map/PDF chunks; this pass does not establish production loading performance.

| Coverage | Final result | Uncovered before → after |
| --- | --- | --- |
| Statements | 99.11% (8,694 / 8,772) | 84 → 78 |
| Branches | 97.42% (6,652 / 6,828) | 176 → 176 |
| Functions | 99.82% (2,312 / 2,316) | 6 → 4 |
| Lines | 99.49% (7,436 / 7,474) | 43 → 38 |

Following that fresh complete coverage run, `npm run coverage:ratchet` tightened the baseline and `npm run coverage:check` passed again. No source changes followed the final suite.

Browser verification used an isolated local demo with Convex and PostHog disabled. A private concern was created, given an outcome and specific ask, reloaded and reopened. A standalone street example opened the shared brief. A standalone intersection retained its purpose and curb-ramp selection after Save and finish, reload and reopening from global My work; PDF generation reached the explicit prepared state with a retained download link. At a measured 320px CSS viewport the street and intersection proposals stayed within the document width. The sampled mobile element controls had no nested option/input/button structures or button targets below 24px. Browser inspection is a sample, not a comprehensive accessibility scan; computer-use browser controls were used after the previous Playwright connection became unavailable. The temporary viewport override and local demo server were cleaned up afterward.

The actual application PDF renderer produced a [four-page long-text fixture](2026-09-27-implementation-evidence/long-brief-fixture.pdf). Every page was rendered and inspected: continuation headers and footers repeated, body text cleared them, diagrams and tables remained legible, and no content clipping was found. The fixture is explicitly fictional and contains no real report or city submission. Tests cover stale exports, failed downloads, corrupt storage, interrupted edits, exact design identity, and source removal without silently rewriting the person’s email.

**Next evidence to collect.** Use the audit’s resident/recipient task measures in a small moderated pilot: can a resident preserve and revise their concern, and can an unfamiliar recipient identify the location, problem and requested next step? Separately test keyboard and screen-reader completion, real mobile keyboards, connected reporting eligibility, production loading performance, and source access. These are the gates for a stronger quality claim, rather than an aesthetic score.
