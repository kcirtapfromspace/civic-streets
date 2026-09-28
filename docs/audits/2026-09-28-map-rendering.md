# Street concepts rendered on the map

Implemented September 28, 2026.

An existing street concept can now be placed on the map without starting a second draft. **View on map** opens placement for an unmapped concept or returns an already placed concept to its location. The review screen offers **Place this layout on the map** and **Adjust map placement**.

## Workflow

- Find the location, then mark at least two points along the street centerline. A live preview draws the layout along that path at the configured element widths. Keyboard users can add the map center; undo and redraw remain available.
- Confirm to save the path, location, and existing concept together in My work. Cancel leaves the original placement intact. A failed save retains the preview for retry and does not commit the attempted placement.
- Edit the layout on the map and see width and element changes immediately. Before/After controls switch the rendered allocation; the active concept is not drawn twice.
- Reload and reopen the saved draft to recover its mapped location and layout. Archived and superseded drafts no longer leave stale map overlays.

The render is a width-scaled, two-dimensional concept overlay with approximate user-marked placement. It is not surveyed geometry. Mobile placement uses a compact scrolling form with persistent confirmation controls; editing starts with side panels closed so the map stays visible. Map styles can recover from a previous provider error.

## Verification

- Node 24, `npm run check`: 1,620 tests in 119 files passed; strict coverage passed for all 237 production files; backend type checking and production build passed.
- ESLint passed for all 116 changed TypeScript source and test files. `git diff --check` passed.
- Fresh passing coverage was ratcheted and then checked again: lines 99.50%, statements 99.12%, functions 99.83%, branches 97.47%. Uncovered counts remain 38 lines, 78 statements, 4 functions, and 176 branches.
- Browser checks covered placing the existing Main Street Road Diet demo along Logan Street by Governors Park, live sidewalk-width changes, Before/After rendering, restoring the original width, adjusting placement, a 324-pixel mobile viewport, and reloading/reopening the saved concept.

The local demo runs at `http://127.0.0.1:4190/map` with backend publishing disabled. The demonstration location is labeled in the draft. Production build output still reports existing large bundle warnings.

## Material surface refinement

The map render now uses six muted material treatments: asphalt, concrete, stone paving, planting, cycle paint, and transit paint. Deterministic 64×64 RGBA repeat tiles add fine grain or organic variation without network requests. Each tile takes 16 KB and is shared by every concept in the map style. More opaque surfaces keep the proposed layout readable over aerial imagery.

Paving joints follow the same offset edges as the width-scaled polygons, using six-foot sidewalk and three-foot furniture-zone spacing. Illustrative lane boundaries distinguish travel, turn, and painted lanes. These details fade in at street scale. Joint counts are capped at 512 per element on long paths. Surface treatments and markings illustrate the concept; they are not specified construction materials or an engineering striping plan.

The renderer re-registers materials after style changes, retains shared images when individual drafts close, falls back to solid material colors if image registration fails, and rolls back partially drawn geometry on rendering errors. Existing saved-concept hit targets remain intact. Implementation follows MapLibre's [pattern fill specification](https://maplibre.org/maplibre-style-spec/layers/#fill-pattern).

Validation after this refinement: **1,669 tests in 122 files**, strict coverage for **239 production files**, backend type checking, production build, scoped ESLint, and whitespace checks all passed. Coverage was freshly ratcheted: statements 99.13%, branches 97.50%, functions 99.83%, lines 99.50%; uncovered counts did not increase. Browser inspection covered material detail at street zoom, before/after switching, and restoring patterns after switching from the map to satellite imagery.
