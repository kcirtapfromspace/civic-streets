# Code coverage results

Verified September 14, 2026 using Node 24. **All 202 production files meet their required per-file standards. There are no legacy coverage exemptions.** Changes are local; no deployment, push, or GitHub branch-protection change was made.

## Whole application

| Measurement | Valid starting baseline | Verified result |
| --- | ---: | ---: |
| Application tests | 244 in 23 files | **920 in 86 files** |
| Coverage-policy tests | 0 | **15** |
| Lines | 22.31% | **99.18%** — 6,318 / 6,370 |
| Statements | 21.61% | **98.70%** — 7,238 / 7,333 |
| Functions | 16.50% | **99.63%** — 1,926 / 1,933 |
| Branches | 20.79% | **96.36%** — 4,981 / 5,169 |

676 application tests were added across this work. All 202 production source files remain in the denominator. The earlier 680-test count included archived worktree copies; those copies were removed from test discovery, not deleted from disk.

## Required standards and enforcement

| Scope | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| Ordinary frontend modules | 80% | 80% | 80% | 75% |
| Backend, shared code, critical client contracts | 90% | 90% | 90% | 85% |

All **43 modules with the stronger standard** pass. These include backend authorization, billing/webhooks, reports/photos, government/organization data, client billing/access, civic submissions, geocoding, crash-data integrations and street constraint validation. Ordinary UI, map/editor state, proposal/intersection journeys, page routes, application startup, and actual PDF generation also pass their standards.

`npm run test:coverage`, `npm run coverage:check` and CI now use the strict gate. A healthy global average cannot hide an untested file, and a historical baseline entry cannot excuse a shortfall. Missing measurements, malformed counts, unexpected source files, and whole-app regressions fail. The baseline was tightened only after the complete passing run; its `files` object is now empty.

See [testing standards](testing-standards.md) for the exact measurement scope and behavioral requirements. Open `coverage/index.html` for uncovered lines and per-file details; JSON and LCOV reports are generated alongside it.

## Regressions found and fixed

- **Private data and collaboration:** public user-design listings and private-design discussions now respect ownership. Foreign workspace references and replies under a different discussion are rejected. Tests use real isolated Convex transactions and inspect persisted records after rejection.
- **Government lead ownership:** a visitor cannot overwrite another visitor's lead by supplying the same email and jurisdiction. Retries from the same owner still update their own lead.
- **Billing:** provider entitlement updates no longer preserve removed extra features. Enterprise client access requires an active/trialing status and the specific entitlement. Late billing responses cannot restore the previous account's data after a session change.
- **Account setup:** failed organization provisioning ends its loading state and displays the failure. Session initialization, invalid-session recovery and logout cancellation have regressions as well.
- **Map and drawing lifecycle:** maps are destroyed when their surface is replaced or unmounted. Deferred style listeners, popups and drawing interactions are cleaned up. Cancelled or obsolete road/intersection responses cannot overwrite newer selections. Drawing restores double-click zoom.
- **Community forms:** reopening a save dialog refreshes its draft, owned photo preview URLs are revoked, and asynchronous submission failures preserve a usable form. Submission and upload limits have boundary and rollback tests.
- **Proposal saving and exports:** sharing uses the actual proposed street; changing from an empty to a ready proposal preserves React hook order. PDF export passes real validation results and supports retry after failure. Tests generate and inspect real PDFs, including before/after and compliance content.
- **Civic receipts:** malformed provider responses do not claim confirmed submission. Open311 batch tokens do not produce invented request URLs; numeric IDs and service notices are handled explicitly. These cases follow the [Open311 GeoReport v2 response model](https://wiki.open311.org/GeoReport_v2/).
- **Navigation and accessibility:** map return links point to `/map`, disabled controls are excluded from modal focus trapping, and route/startup tests exercise actual lazy page loading and navigation.

The transformation picker also uses the same validated template catalog as the gallery, replacing its duplicated discovery path.

## Final verification

- **`npm run check` passes on Node 24:** 15 policy tests, 920 app tests, strict coverage for 202 files, Convex TypeScript, frontend TypeScript and production build.
- **`npm run coverage:ratchet` passes:** all legacy per-file exceptions removed; the verified whole-app counts are preserved as the regression ceiling.
- Scoped ESLint passes for all 89 new test/fixture files and the regression fixes checked during implementation. Tests were formatted using the repository's Prettier settings.
- Negative policy tests reject omissions, uncovered-code growth, percentage regression, insufficient per-file coverage and attempts to rely on legacy exemptions. Earlier disposable smoke tests confirmed unmocked fetches fail even when caught, and `.only` fails under `CI=true`.
- Tests use isolated backend state and provider fixtures. The PDF renderer reads its embedded Yoga WASM bytes through a data-URL fixture. No real reports, uploads, payments, messages or provider changes were made by tests.
- CI is configured for Node 24, a clean lockfile installation, read-only permissions, pinned action revisions and coverage artifacts retained for 14 days. The workflow becomes active when pushed; GitHub has not run it yet. Clean strict-peer installation was verified during setup.

## Release limits

Coverage is not proof of real browser rendering, accessibility, WebGL behavior, production storage metadata, external delivery or deployment configuration. Run the staged checks in [the release plan](security-and-coverage.md) before publishing changes to those contracts. These tests did not deploy the app.

Existing CSS import-order and large-bundle build warnings remain. Repository-wide lint has separate pre-existing debt and is not part of the passing `npm run check` claim. Cross-hook auth synchronization and verified sign-in remain separate from the tested per-hook session lifecycle.
