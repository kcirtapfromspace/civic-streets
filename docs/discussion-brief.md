# Concern → Explore → Brief

The original product goal is to help residents turn a street concern into understandable material for a planning conversation. Capture remains useful on its own; street design is an optional next step.

## Implemented workflow

- An observation can start a proposal with its location, identity, original notes, photo references, saved time, and source label carried forward.
- The Concern stage captures the resident's purpose. Explore keeps the existing layout and transformation tools. Brief presents allocation changes, a requested next step, and dimension assumptions.
- Concern and evidence remain editable/visible through a disclosure during exploration and review. Original observation notes remain separately identified as a snapshot.
- Completed saved drafts retain context through browser reload, including old-draft compatibility and validation of stored context. Partial proposals remain in memory; the app warns before leaving with unsaved work. Saved drafts are local to the browser, not synchronized community documents.
- Downloaded PDFs open with the concern and requested next step. Concept diagrams and allocation changes precede an appendix of selected dimensional checks. Existing-condition dimensions can be assumed, estimated, or described by the author as measured; proposed widths always remain concept allocations.
- Measured existing dimensions need a source/method before exporting from the proposal review. This does not independently verify measurements.
- An observation can produce an evidence-only brief without a street concept. Desired outcome and requested next step are optional additions.
- Photo exports include up to two available PNG/JPEG images, each bounded to four MiB and a four-second fetch timeout. Unavailable photos receive an explicit caption. Saved drafts retain references, not permanent offline copies of remotely hosted photos.
- PDFs are generated locally and nothing is automatically submitted to a government or other recipient. Example and session observations retain their source labels in exports.
- Edited drafts cannot continue downloading a stale prepared PDF. Failed exports preserve editable inputs and allow retry.

## Scope

Selected dimensional checks are not a complete engineering, accessibility, legal, or local-code assessment. The result list contains findings, not a count of checks performed. This work does not establish user-research validation, planner acceptance, government delivery, or real-world outcomes.

The current low-friction validation exercise is to have a resident make one brief and a potential recipient explain what it helps them understand, what is missing, and what decision or next step it could inform. Record that feedback before broadening the product.

## Bike Streets comparison, September 27, 2026

The public [Denver Bike Streets map](https://bikestreets.com/co/denver/) combines low-stress routing with route, construction, hazard, note, and walk-bike contributions. Its contribution interface asks what others should know and how long a condition might last. It also exposes discussions and Yes/No/Not Sure responses. These observations come from public interface content; saving, authentication, and moderation were not tested.

The [Cone Grants announcement](https://bikestreets.com/blog/announcing-bike-streets-cone-grants) describes demonstration projects with jurisdiction approval, an observable hypothesis, neighbor feedback, photographs, and quantitative/qualitative reporting. This is a useful example of a possible downstream use for understandable design material; it does not imply a partnership or that our brief meets their requirements.

Product implications to validate next:

- Explain who benefits from each contribution and how another person can use it.
- Distinguish a temporary condition from a persistent street-design concern; date/confirmation information helps readers assess relevance.
- Let people agree, disagree, or express uncertainty about a specific observation or option, with substantive context rather than popularity alone.
- Build credibility with a real place, field observations, named participants who consent to attribution, and visible feedback on the output.

These are future research/design opportunities, not new features implemented by this change. The current focus remains carrying evidence and purpose into a discussion brief. See [media brief](capture-media-brief.md) for an updated walkthrough direction.

## Verification

The final Node 24 `npm run check` passed application tests, coverage policy checks for all 222 production modules, backend typechecking, and the production build. Coverage was tightened only after that complete passing run. Changed files received scoped lint checks.

Real PDF rendering was tested and the three-page concept brief and one-page evidence-only brief were visually inspected. Browser checks covered observation-to-proposal context, local draft reload, prepared PDF links, and the phone-width layout. Additional regressions cover unsaved replacement warnings, edited PDF invalidation, editor handoff, map cleanup on navigation, and demo editor billing without a backend provider.
