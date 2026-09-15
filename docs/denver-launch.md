# Denver reporting launch

Updated September 14, 2026.

## Release status

**Denver community reporting is enabled on the backend used by the live site.**

- Live frontend: https://curbwise.onrender.com/map
- Backend currently used by that site's published JavaScript: `chatty-puffin-875.convex.cloud`.
- Deployed the tested backend with `npx convex dev --once --typecheck enable --tail-logs disable`.
- Verified the deployed validator accepts Denver, Denver airport and Chicago geography, then correctly requires a photo for a new reporter. Verified Los Angeles is still outside the pilot. These checks published **zero reports**; they created one empty anonymous validation account.
- Full successful create/read/photo-resolution tests run in an isolated Convex test backend, not against public community data.
- **Frontend changes are prepared locally but not published.** Render's dashboard opens at its sign-in screen. Connected branch, deployment settings and dashboard access must be verified to release this code.

The live site uses a Convex **development** deployment. A separate production deployment exists at `cautious-bison-677.convex.cloud`. A normal `npx convex deploy` would update that separate deployment and would not change the backend currently used by the website. A future production cutover must deliberately preserve community data and verify environment settings before rebuilding the frontend with the production URL.

## What changed

1. Replaced the Chicago-only reporting restriction with explicit Chicago and Denver pilot coverage in `shared/reporting-areas.ts`. Denver covers latitude 39.55–40.00 and longitude -105.15–-104.55, including the airport. These are approximate **community pilot bounds**, not municipal boundaries or a promise of city-service coverage.
2. Reject non-finite and out-of-range coordinates. Keep photo requirements, duplicate detection, cooldowns and daily/hourly limits. Bound recent duplicate/rate reads using existing indexes; no schema migration.
3. Allow empty additional details because the form explicitly offers “Skip details.” A title, category, location and the applicable photo requirement still apply.
4. Preserve the form on failed saves, display safe validation errors, block duplicate clicks, and close only after a saved report ID. Surface missing sessions and failed image processing/uploads; avoid storing browser-only photo-preview URLs.
5. Provide an explicit **Continue at Denver 311** handoff to the [official city portal](https://www.denvergov.org/Online-Services-Hub/Report-an-Issue), independent of Curbwise's government-contract status. Residents must confirm the address is within Denver and submit there themselves. No automatic city submission, photo transfer or city tracking is claimed. This uses the existing narrower central-Denver routing hint; it does not cover every accepted community-report coordinate.

Items 4–5 and the updated form copy require the frontend release.

## Resident flow

Open the map, search for Denver or a specific intersection, click/tap the location, and choose **Report a Hotspot**. New reporters need a photo. The report becomes a Curbwise community record after successful persistence. A city case is a separate submission.

## Current technical work

**Security and coverage fixes are now implemented locally.** See the [security and coverage release report](security-and-coverage.md) for the full scope, remaining risks, validation and coordinated release sequence. They are not yet present on the live site.

| Area | Current status / next acceptance condition |
| --- | --- |
| Accounts and access | Unsafe self-asserted upgrades are disabled; private report ownership and public field projections are enforced. Verified sign-in, recovery and token lifecycle remain. |
| Photos and privacy | Server-owned uploads, limits, quotas, atomic claims, orphan cleanup and public metadata redaction implemented. Stage-test actual storage metadata, publish retention rules and staff moderation. |
| Representative handoff | Official Denver directory with explicit office selection and honest email-draft status implemented. Maintain directory freshness; delivery and receipt remain external. |
| Search and crash coverage | Submitted searches through a shared proxy/cache/limiter and the official Denver crash adapter implemented. Choose/configure a geocoder. National crash map coverage is explicitly unconnected. |
| Operations | Confirm Render access, coordinate both releases and deliberately choose the backend. Establish staging, backup/recovery, monitoring, cost alerts and a named operator. |
| Community participation | Verify durable comments/proposals, geographic report pagination, participant follow-up and moderator tools. Test mobile, keyboard and screen-reader flows. |
| Measurement | Track completion/errors, repeat contributors, response time and a recurring public “you reported / what happened” update with participant consent. |

Useful verified sources:

- [Denver official crash layer 325](https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325): five calendar years plus current year, 2,000-record query limit; incident ID and bicycle/pedestrian/injury fields are available. Build an adapter against the published metadata rather than assuming field names or unlimited results.
- [Google Civic Information API retirement notice](https://groups.google.com/g/google-civicinfo-api/c/lR8kT7Uc0sE): representative endpoint retired April 30, 2025.
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/): no autocomplete; public-service aggregate traffic limits apply.

## Validation

- **Historical count: 680 tests across 56 files included archived worktree copies.** See [corrected app-only results](testing-results.md) and [enforced testing standards](testing-standards.md) for the current verified suite.
- Production build and frontend/backend TypeScript checks pass.
- Repository-wide lint remains at 33 errors/3 warnings (earlier tracked HEAD: 39 errors/3 warnings). New security, geocoding, coverage and contact modules pass targeted lint; existing errors remain elsewhere, including legacy paths in the modified hotspot hook.
- Browser inspection confirmed the reporting form in the preceding change and the explicit-search error state and Denver contact selection in the current local frontend. Successful new-protocol upload and geocoding need staged end-to-end checks before release.
- A genuine resident/operator report remains the production smoke test after the coordinated release. Do not publish fabricated reports for testing.
