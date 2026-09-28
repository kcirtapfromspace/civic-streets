# Jev report assistance

The first integration helps residents classify a report, identify details to add,
and review potentially related nearby reports. It is available in step 2 of the
existing report form. Clicking **Suggest** is the only trigger; typing, map movement,
and ordinary report submission never call TypeSafe.

Residents keep control of the issue type, severity, description, and submission.
A suggestion is optional. Related reports open in another tab, preserving the draft;
there is no automatic merge, vote, city submission, or change to an existing report.
Street design recommendations and institutional prioritization are outside this release.

## Configuration

Use Node 24. Configure the selected Convex deployment with:

- `TYPESAFE_API_KEY`: the existing `typesafe_ai_api_key` field in the Curbwise
  1Password item. Keep the value in the backend secret environment; never use a
  `VITE_` variable, commit a secret file, or print the key.
- `REPORT_ASSISTANCE_ENABLED=true`: explicit feature switch. Any other value
  disables provider requests. Disabling it preserves normal reporting.

The frontend uses its existing `VITE_CONVEX_URL` and anonymous reporting session.
Deploy the backend/schema before the frontend. The schema adds an independent
`reportAssistance` table; existing report rows require no migration or backfill.
Use `npx convex dev --once` for the configured development deployment. Production
release should follow the normal release process after evaluation below.

The endpoint is fixed to `https://api.typesafe.ai/v1/systemone`, with redirects
rejected and an eight-second timeout. The model is pinned to `jev-1.13.0`, and the
criteria version is `report-intake-v1`. Provider errors are replaced with a safe,
recoverable message. The full integration works without an SDK dependency.

## Decision boundaries

- Classification choices come from the same issue taxonomy as the manual form,
  with an explicit `unknown` option. Confidence of at least 0.80 exposes a
  suggestion; `unknown` never becomes a suggested type.
- Three independent questions consider precise position, timing, and impact.
  Only a `missing` answer at confidence of at least 0.80 shows a follow-up.
  The displayed questions are authored application text, not generated prose.
- Code retrieves at most 250 records in a narrow indexed latitude band, removes
  resolved reports and those beyond 150 meters, then sends the nearest five.
  Jev assesses whether each describes the same specific issue. A Noul probability
  of at least 0.85 exposes a related-report link. This bounded search is not an
  exhaustive duplicate detector and cannot suppress a report.
- These are initial suggestion thresholds, not measured accuracy guarantees.
  No automatic severity, emergency response, engineering, or jurisdiction decision
  depends on Jev.

## Data, authorization, and retention

The provider receives the resident's description and the titles/descriptions of
shortlisted public reports. It receives no session tokens, account identifiers,
coordinates, separate address field, images, or EXIF. Residents see a disclosure
before requesting suggestions and are asked to avoid personal details in prose.
User-entered text can itself include personal information; it is not automatically
redacted. Report text is explicitly treated as untrusted data in the questions.

A valid reporting session is required. An atomic per-user quota permits ten
suggestion requests per hour, separately from report-submission quotas. Failed
provider calls count toward this quota. There are no automatic provider retries.
The provider response is bounded to 32 KiB and validated before advice is stored.

Advice is private server-owned data. It records the input snapshot, model and
criteria version, decisions, confidence/probability values, and creation time.
No public query exposes this table. When a resident submits the exact same draft,
the backend links the advice to the new report and records the selected issue type,
including a manual override. Missing, expired, foreign, replayed, or edited-draft
advice is ignored and cannot prevent an otherwise valid submission. Original
report fields remain authoritative. Advice is attached in the report transaction,
so a failed submission cannot partially attach it.

Unattached advice expires after 24 hours. An hourly job removes expired drafts in
batches of 100. Advice attached to a report remains for evaluation; it has no automatic expiry or report-deletion cascade in this release.
UI responses for edited or closed drafts are discarded.

## Validation and rollout

Run `npm run check` and then `npm run coverage:ratchet` after the complete passing
coverage run. Provider calls in automated tests use fixtures. Tests cover privacy,
identity and quota isolation, bounded candidates, malformed output, timeouts,
threshold boundaries, stale advice, overrides, draft preservation, retries, cleanup,
and normal submission with assistance disabled or unavailable.

Before a broad rollout, evaluate at least 200–500 consented, independently reviewed
examples, including ambiguous descriptions, repeated incidents, different defects
at one location, adversarial text, accessibility issues, and non-English reports.
Compare against the manual taxonomy/rules and measure accepted/corrected categories,
useful follow-up questions, false related matches, completion time, and submission
completion. Tune thresholds against held-out data and check language-specific
performance. A model or criteria change requires repeating this evaluation.

Official reference: [TypeSafe documentation](https://docs.typesafe.ai/introduction),
[model contract](https://docs.typesafe.ai/models), and
[known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

## Verified development setup (September 27, 2026)

The configured `chatty-puffin-875` development deployment has the backend secret
and feature switch set, and the additive schema/functions deployed. A live API
smoke test returned the pinned model and the expected vehicle-blocking choice.
The local browser flow also returned a vehicle-blocking suggestion and a relevant
location follow-up, accepted the suggestion, allowed a manual category override,
and preserved the narrative on the review step. The test draft was canceled; no
community report or city submission was published.

Node 24 validation: `npm run check` passed 1,088 tests across 93 test files,
all 213 production modules met their coverage gates, and the coverage baseline
was tightened using `npm run coverage:ratchet`. New modules pass ESLint. The
existing `src/lib/api/use-hotspots.ts` lint debt is unchanged outside the two
assistance-ID additions. Production frontend publishing is still a separate step.
