<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Testing and coverage

Follow [docs/testing-standards.md](docs/testing-standards.md). Use Node 24 and run `npm run check` before handing off code changes. Test discovery must remain limited to application source roots; archived agent worktrees are not part of the app suite.

Every production module must meet the per-file coverage policy; historical baseline entries do not exempt files from the strict gate. Whole-app coverage must not regress in percentage or uncovered counts. After adding tests, tighten the baseline with `npm run coverage:ratchet` only after a fresh, complete passing coverage run. Never lower thresholds, add exclusions or overwrite baseline debt just to make a test run pass. Tests must exercise behavior and use isolated backend state/provider fixtures; unmocked fetch requests are prohibited.
