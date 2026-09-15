# Testing and code coverage standards

Effective September 14, 2026. Policy is executable in `scripts/testing/coverage-policy.mjs`; `coverage-baseline.json` records the regression ceiling. Run **`npm run check`** before proposing a merge.

## Required coverage

Each metric is checked independently, per production file. Lines/statements measure executed code; functions measure exercised functions; branches measure alternative decisions such as success/failure and authorized/unauthorized.

| Scope | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| Ordinary frontend modules; all new ordinary modules | 80% | 80% | 80% | 75% |
| Backend and shared modules; critical client contracts | 90% | 90% | 90% | 85% |
| Whole application | At least 80% lines/statements/functions and 75% branches; recorded percentage cannot fall **and** uncovered count cannot grow, for every metric |

Critical client contracts include authentication, billing/organization access, report/photo submissions, civic API dispatch, geocoding/search, official recipient validation, crash adapters/cache/store and street constraint validation. The precise file list is in the policy module. All `convex/` and `shared/` code receives the stronger standard, including future files.

**The normal test command and CI enforce the full standards for every production file.** A high application average cannot hide an untested file. No legacy baseline entry exempts a file from its minimum. Review tests against the changed behavior even when a file's percentage passes.

### Regression protection

- Every production file is in the report, including zero-coverage files. Existing and new files must meet their standard immediately.
- The original debt baseline supported gradual improvement. The strict gate now checks each file's full target in addition to the regression rules. Its per-file debt entries are removed only when the full report proves the standards are met.
- Whole-app coverage cannot regress in either uncovered counts or percentage terms. Adding untested lines cannot pass merely by enlarging the denominator.
- After adding tests, run `npm run coverage:ratchet` following a fresh complete coverage run. It requires the strict standards, only tightens existing counts or removes resolved entries, and cannot add exemptions. Commit the changed baseline with the tests.
- CI never rewrites the baseline. Lowering standards, expanding exclusions or manually weakening the baseline requires an explicit rationale and review in the change description. Do not use coverage-ignore comments or trivial assertions to make the numbers pass.
- Ratchet checks use counts rather than rounded display percentages. Pin Vitest and its V8 provider together; review and regenerate measurements deliberately when the tooling changes.

## Measurement scope

Tests are discovered only under `src/`, `convex/` and `shared/`, using `.test`/`.spec` filenames. Production coverage includes TypeScript and JavaScript variants under those roots, whether imported by tests or not. Generated Convex files, declarations, tests and test helpers in `__tests__` are excluded. Runtime configuration, ordinary UI, mocks used by the app and runtime exports from type modules remain included. Declaration-only files have no executable items.

The coverage checker independently inventories production files. Missing source measurements, malformed reports and unexpected files fail the check. Tests in archived worktrees and agent/plugin directories are not application tests and cannot inflate the count. The coverage-checking scripts have a separate Node test suite and are not counted as app coverage.

**Correction to previous test counts:** the earlier “680 tests in 56 files” included tests inside `.claude/worktrees`. The valid starting baseline for this work was **244 application tests in 23 files**, with 22.31% lines, 21.61% statements, 16.50% functions and 20.79% branches across 202 production files. See [current coverage results](testing-results.md) for the updated run.

## Required test behavior

| Change | Required evidence |
| --- | --- |
| Account, authorization or private data | Owner and non-owner cases; missing/invalid session; public projection; revoked/missing records; no partial mutation after rejection. |
| Report or photo mutation | Actual Convex transaction where possible; save/read; exact boundaries; quota isolation; foreign/replayed/expired IDs; failure rollback and cleanup. |
| Provider/data integration | Fixture-backed network boundary; valid empty vs error; invalid rows; pagination/caps; unknown values; date bounds; cache expiry and stale-response races. |
| Resident workflow | React Testing Library interactions with real state transitions; disabled/invalid inputs; failure preserves work; retry; duplicate submissions; accurate outcome text. |
| Pure domain logic | Boundary conditions, impossible inputs and meaningful invariants, including width/allocation priorities. |
| Bug fix | A regression that fails against the faulty behavior and passes with the fix. |

Assert observable outcomes and persisted records. Do not mock the function under test, replace transaction semantics with a fake object, or assert implementation details only. Mock external services and nondeterministic boundaries. Use fixed dates/fake timers for time-sensitive behavior and restore state after each test. Unexpected `fetch` calls fail the suite, even if application code catches the error; provide an explicit provider fixture. Focused `.only` tests fail in CI. Skips need a documented reason and follow-up; they are not a way to satisfy a release requirement.

Unit coverage does not prove accessibility, WebGL behavior, real storage metadata, delivery, backup recovery or correct production configuration. Before a release that changes those contracts, run the staged smoke checks in [the release plan](security-and-coverage.md). Do not publish fabricated community reports or send real messages from automated tests. The Convex storage MIME-metadata test shim is documented in [photo uploads](security/photo-uploads.md).

## Commands and reports

Use Node 24 (`.nvmrc`) and `npm ci` for the CI-compatible environment.

| Command | Purpose |
| --- | --- |
| `npm test` | Fast app tests, without coverage collection. |
| `npm run test:watch` | Interactive app tests while developing. |
| `npm run test:policy` | Negative/positive tests of the coverage enforcement itself. |
| `npm run test:coverage` | Complete V8 report followed by strict per-file standards and regression checks. |
| `npm run coverage:check` | Recheck an existing report; does not rerun tests. |
| `npm run coverage:strict` | Explicit full-standard check of an existing report; legacy exemptions cannot pass. |
| `npm run coverage:ratchet` | Tighten the baseline after a fresh, passing complete report. |
| `npm run check` | Policy tests, app coverage gate, Convex TypeScript and production build. |

Open `coverage/index.html` for per-file uncovered lines. `coverage/coverage-summary.json`, `coverage/coverage-final.json` and `coverage/lcov.info` support analysis and external tooling. Reports are ignored by Git and uploaded by CI for 14 days. A targeted test run is useful during development but must not replace the full report used by the gate or ratchet.

## CI and review

`.github/workflows/quality.yml` runs on pull requests and pushes to `main`, without deployment credentials. The job fails on tests, coverage policy, backend type errors or build errors and retains coverage reports after failure. It uses read-only repository permissions and pinned action revisions. This workflow becomes active once the files are pushed; configure **Tests, coverage and build** as a required branch check in GitHub to prevent merging around it.

Repository-wide lint has existing debt and remains a separate command; it is not silently presented as passing by `npm run check`. New and changed test/source files should pass their scoped lint checks. The ESLint configuration package is aligned with ESLint 9 so clean CI installation does not depend on a developer's `legacy-peer-deps` setting.

Implementation references: [Vitest coverage configuration](https://vitest.dev/config/coverage), [Vitest coverage guide](https://vitest.dev/guide/coverage.html), [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
