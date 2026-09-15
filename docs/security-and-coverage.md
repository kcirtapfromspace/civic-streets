# Security and coverage release status

September 14, 2026. **Implemented and tested locally; this release is not deployed.** Denver community reporting was enabled on the live backend in the preceding change. The current security and coverage improvements require a coordinated frontend/backend release.

## Implemented

| Area | Result |
| --- | --- |
| Account takeover | Caller-supplied email/provider IDs can no longer upgrade or merge accounts. Account upgrades and profile edits fail closed until verified sign-in exists. Anonymous reporting remains available. Public user responses exclude credentials and email; owner email is contact information, not verified identity. |
| Private reports | Owner sessions are required for private report reads; user report lists derive the owner from the session. New reports default private. Public summaries exclude letter bodies, recipient email and workspace metadata. Creation checks organization/workspace and private-design ownership. |
| Photo ownership | The server creates and binds each storage ID to the uploader. Report creation atomically rejects foreign, arbitrary, duplicate, expired or replayed IDs. The old unrestricted upload-URL endpoint is disabled. |
| Upload limits | Up to three JPEGs per report, 512 KiB each, with server frame/dimension checks, per-session and deployment-wide attempt/byte quotas, a cumulative pilot ceiling, and bounded orphan cleanup. See [upload limits and rollout](security/photo-uploads.md). |
| Metadata privacy | New reports omit extracted EXIF and device fingerprints from stored report metadata. Public hotspot responses redact legacy EXIF and location-verification objects. Image bytes remain untrusted; header checks are not a complete image decoder or metadata sanitizer. |
| Denver crash coverage | Uses the [official Denver ArcGIS layer](https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325), verified against live metadata and a bounded date/location query. Paginates, deduplicates incidents, handles unavailable counts and retains unknown severity. Source dates, limits, partial results, failures and retry are visible. Chicago and NYC remain connected. |
| National coverage | The former FARS adapter used unsupported location parameters. It now explicitly shows national map coverage as unconnected and links the [official NHTSA viewer](https://cdan.dot.gov/query). An unavailable source is never presented as zero crashes. |
| Place search | Explicit submitted searches replace autocomplete. Forward and reverse lookups share a Convex proxy, application-wide request lease, session quota and bounded cache. Errors remain visible; coordinate-based reporting still works. No upstream provider is configured by default. See [provider configuration](geocoding.md). |
| Representative contacts | Removed the retired lookup API and fictional fallback from the production flow. Denver contacts come from the [official council directory](https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Denver-City-Council/Contact-Information), checked September 14, 2026. Residents explicitly confirm/select an office. Saved selections stop being offered after December 13, 2026; other cities use manually supplied official contacts. |
| Email handoff | “Open Email Draft” replaces claims of sending. Recipient validation rejects header injection and malformed addresses. Opening a mail app does not prove delivery or receipt. |

## Remaining work before recruitment

1. **Release and operate the changes.** Confirm Render access and the intended backend. The live frontend uses development deployment `chatty-puffin-875`; default `convex deploy` targets separate production `cautious-bison-677`. Do not switch URLs without a community-data migration/recovery plan. Establish monitoring, cost alerts, staging and a tested recovery procedure.
2. **Choose geocoding.** Set `GEOCODING_BASE_URL` only after choosing a compatible provider and accepting its terms. The public Nominatim option requires the operator's deliberate choice and continued compliance with its [usage policy](https://operations.osmfoundation.org/policies/nominatim/). A different API format needs a server adapter. No paid service was provisioned.
3. **Finish durable identity and abuse response.** Verified sign-in, recovery, token expiry/revocation and staff account migration remain. Anonymous bearer tokens still live in browser storage. Anonymous accounts can be created freely; global upload quotas bound storage but do not prevent bots, invocation costs or denial of service. Add moderation/removal tools and assign a moderator.
4. **Define publication and retention.** Establish participant notices, photo/GPS expectations, deletion handling and retention. Legacy stored metadata and files were preserved; this patch does not purge historical records or sanitize every image byte.
5. **Make community participation durable.** Existing mock/in-memory comment and proposal paths, report geographic pagination, follow-up opt-in, status subscriptions, accessibility and mobile checks remain. Crash source coverage does not imply complete street-safety evidence or a city-service integration.

This is a focused remediation of identified account, report, upload and map-data paths, not a complete audit of billing, government administration, dependencies or all application authorization.

## Release sequence

1. Prepare a matching frontend/backend build on an isolated staging deployment. Schema changes add upload and geocoding tables; no legacy backfill is required.
2. Configure the chosen geocoder and verify submitted search, reverse lookup, rate-limit errors and map selection. Test real storage metadata with an actual staged photo upload; the test backend requires a documented MIME-metadata shim.
3. Check a full staged report save/reload, private report ownership, rejected foreign/replayed photo IDs, legacy images and cleanup behavior. Use test data in staging. A genuine resident/operator report can verify production after release; do not publish fabricated community reports.
4. Coordinate the frontend/backend switch through Render. An old frontend cannot upload through the new protocol. Previously issued direct upload URLs may remain valid for one hour. Do not restore unrestricted uploads as a rollback shortcut.
5. Verify the live frontend's backend URL and release version, perform the genuine-report smoke check and monitor submission errors, quotas and orphan cleanup.

## Validation evidence

- Historical suite count: **680 passing tests in 56 files included archived worktree copies**. The [corrected app-only results](testing-results.md) and [enforced testing standards](testing-standards.md) supersede that count.
- Frontend production build and Convex TypeScript checks pass.
- New security, geocoding, coverage and contact modules pass targeted lint; diff checks pass. Repository-wide lint still has legacy errors, including in the modified hotspot hook, and three warnings. The earlier tracked-HEAD baseline was 39 errors and 3 warnings; current counts are recorded in the launch notes.
- Independent agent cross-reviews found no actionable issue in upload ownership/redaction or Denver coverage handling. A malformed provider-coordinate parsing mismatch was found in geocoding, fixed by canonicalizing validated coordinates, and covered by a regression test.
- Live Denver service query returned HTTP 200 with CORS and WGS84 geometry. Unit tests mock upstream data and do not establish source completeness.
- Local browser inspection confirmed explicit search, a visible failure message, and official Denver contacts with no preselected recipient. The new backend actions have not been deployed, so a real end-to-end geocoding/upload smoke check remains a release requirement.
