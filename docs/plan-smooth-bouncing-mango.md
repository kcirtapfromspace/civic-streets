# Street Copilot Phase 0: Parallel Build Plan

## Context

Street Copilot is an AI street-design copilot for civic users. The team review (5 agents: product, devil's advocate, accessibility, competition, technical) converged on a revised roadmap where **Phase 0 ships in 4-6 weeks** as "Streetmix with Standards" -- manual width input, template gallery, NACTO/PROWAG feasibility checking, SVG cross-sections, and professional PDF export. No photos, no CV, no AI, no map.

The goal: validate that advocates and planners find standards-grounded street concept reports valuable enough to use and pay for.

**User decisions:**
- Vendor @streetmix/illustrations SVGs locally (CC BY-SA 4.0)
- Skip shareable links for Phase 0 (focus on editor + PDF export)
- Scaffold first, then launch parallel agents

---

## Build Architecture: 4 Workstreams + 1 Lead

### Round 0 (Days 1-2): Foundation -- Sequential, Single Agent

One agent scaffolds the project and defines all shared types. This MUST happen first because every parallel workstream depends on frozen type contracts.

**Deliverables:**
- Next.js 14+ project scaffold (App Router, TypeScript, Tailwind)
- Dependencies: `zustand`, `zundo`, `@react-pdf/renderer`
- Vendor @streetmix/illustrations SVGs into `public/illustrations/`
- Full directory structure with stubs
- **Core types** (`src/lib/types/street.ts`): `StreetSegment`, `CrossSectionElement`, `ElementType`, `DimensionalConstraint`, `ValidationResult`, `TemplateDefinition`
- Zustand store interface (skeleton, not implementation)
- Shared constants: color palette per element type, default dimensions, units
- ESLint, Prettier, tsconfig paths

### Round 1 (Days 3-10): 4 Parallel Workstreams

| Agent | Workstream | Scope | Days |
|-------|-----------|-------|------|
| **A** | WS1: Standards Engine | NACTO/PROWAG JSON data files, validator, PROWAG-first constraint solver. Pure TypeScript, no React. Unit tested. | 5-6 |
| **B** | WS2: SVG Renderer | `CrossSectionSVG.tsx`, per-element SVG components, dimension labels, validation overlays, before/after view, alt-text generator, export mode (static SVG string for PDF). Vendored illustration overlays. | 6-8 |
| **C** | WS3: Template Library + PDF Export | 10-15 template JSONs, parametric width adapter, common ROW profiles. Then: PDF report generator (`@react-pdf/renderer`) with standards citations, width table, disclaimers. | 6-8 |
| **D** | WS4: UI Shell + Store | Full Zustand store with undo/redo (zundo), editor panel, element rows, validation panel, toolbar, template gallery modal, accessible UI primitives. | 6-8 |

Each workstream works against mock data during Round 1 -- no cross-workstream dependencies yet.

**Why PDF moved to WS3:** Template Library finishes in ~4-5 days, leaving Agent C available. PDF export depends on having template/standards data to cite, which C already owns. The PDF renderer needs the SVG export mode from WS2 -- C can stub this initially and wire it in Round 2.

### Round 2 (Days 8-14): Integration

Integration pairs wire the workstreams together:
- **WS1 + WS4**: Validator wired into store (mutations trigger re-validation, results display in ValidationPanel)
- **WS2 + WS4**: SVG renderer wired into editor page (store changes re-render cross-section)
- **WS3 + WS4**: Template gallery wired to adapter + store (apply template populates editor)
- **WS1 + WS3**: Validator wired into template adapter (post-adaptation PROWAG check)
- **WS2 + WS3**: SVG export mode wired into PDF generator (cross-section image in report)

### Round 3 (Days 12-18): Polish + QA

- Accessibility audit: keyboard nav, ARIA, alt text, color contrast
- Before/after comparison flow end-to-end
- Edge cases: infeasible templates, extreme ROW widths, zero-width elements
- Error boundaries, loading/empty states
- Responsive layout basics
- PDF quality check: standards citations with page numbers, disclaimer language, visual polish

### Round 4 (Days 16-20): Deploy + Validate

- Vercel deployment + preview URLs
- End-to-end smoke testing
- Performance profiling (SVG rendering)
- Prepare 3 "hero street" examples (pre-built designs showcasing the tool)

---

## File Ownership (Prevents Merge Conflicts)

| Directory | Owner | Read by |
|-----------|-------|---------|
| `src/lib/types/`, `src/lib/constants/` | Lead (frozen after Round 0) | All |
| `data/standards/`, `src/lib/standards/` | WS1 | WS3, WS4 |
| `src/features/renderer/` | WS2 | WS3 (PDF), WS4 |
| `data/templates/`, `src/lib/templates/` | WS3 | WS4 |
| `src/features/export/` | WS3 (PDF export) | WS4 (toolbar button triggers it) |
| `src/stores/`, `src/features/editor/`, `src/features/gallery/`, `src/components/ui/` | WS4 | All |
| `src/app/page.tsx`, `src/app/layout.tsx` | WS4 | None |
| `public/illustrations/` | Lead (vendored in Round 0) | WS2 |

---

## Interface Contracts

**Store <-> Validator (WS4 <-> WS1):**
```typescript
import { validateStreet } from '@/lib/standards/validator';
const results = validateStreet(currentStreet, standards);
set({ validationResults: results });
```

**Store <-> Renderer (WS4 <-> WS2):**
```typescript
<CrossSectionSVG
  street={currentStreet}
  validationResults={validationResults}
  mode="display"
  onElementClick={(id) => selectElement(id)}
/>
```

**Templates <-> Validator (WS3 <-> WS1):**
```typescript
const adapted = adaptTemplate(template, targetROW);
const results = validateStreet(adapted, loadStandards());
```

**PDF <-> Renderer (WS3 <-> WS2):**
```typescript
// WS2 must expose this function for PDF embedding:
const svgString = renderToStaticSVG(street, validationResults);
```

**PDF <-> Store (WS3 <-> WS4):**
```typescript
// Toolbar "Export PDF" button calls:
import { generatePDF } from '@/features/export/pdf-generator';
const blob = await generatePDF(currentStreet, beforeStreet, validationResults);
```

---

## Key Technical Decisions

- **Stack**: Next.js 14+ App Router, React, TypeScript, Zustand + zundo, Tailwind, SVG rendering
- **Standards**: Version-controlled JSON in repo, not a database
- **PROWAG**: Hard constraint -- solver allocates pedestrian space first, always
- **Rendering**: SVG (vector, interactive, crisp at all sizes, printable)
- **PDF**: `@react-pdf/renderer` with SVG-to-PNG fallback for cross-section embedding
- **Sharing**: Deferred to Phase 0.5
- **No 3D**: Cross-section view is sufficient for Phase 0
- **No map**: Address-grounding comes in Phase 0.5
- **Illustrations**: Vendored @streetmix/illustrations SVGs in `public/illustrations/` (CC BY-SA 4.0)

---

## Core Data Model (defined in Round 0)

```typescript
// src/lib/types/street.ts

type ElementType =
  | 'sidewalk' | 'planting-strip' | 'furniture-zone'
  | 'bike-lane' | 'bike-lane-protected' | 'buffer'
  | 'parking-lane' | 'travel-lane' | 'turn-lane'
  | 'transit-lane' | 'median' | 'curb';

interface DimensionalConstraint {
  absoluteMin: number;        // PROWAG hard minimum (feet)
  recommendedMin: number;     // NACTO recommended minimum
  recommended: number;        // NACTO ideal
  absoluteMax: number;        // practical maximum
  source: string;             // "NACTO USDG p.42"
  prowagRequired: boolean;    // ADA hard constraint flag
}

interface CrossSectionElement {
  id: string;
  type: ElementType;
  side: 'left' | 'right' | 'center';
  width: number;              // feet
  constraints: DimensionalConstraint;
  locked: boolean;
  label?: string;
  variant?: string;
}

interface StreetSegment {
  id: string;
  name: string;
  totalROWWidth: number;
  curbToCurbWidth: number;
  direction: 'one-way' | 'two-way';
  functionalClass: 'local' | 'collector' | 'minor-arterial' | 'major-arterial';
  elements: CrossSectionElement[];
  metadata: { createdAt: string; updatedAt: string; templateId?: string; };
}

interface ValidationResult {
  valid: boolean;
  severity: 'error' | 'warning' | 'info';
  elementId: string;
  constraint: 'prowag' | 'nacto' | 'dimensional';
  message: string;
  citation: string;           // "PROWAG R302.3"
  currentValue: number;
  requiredValue: number;
}

interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: 'road-diet' | 'protected-bike' | 'transit-priority' | 'complete-street' | 'shared-street';
  applicableROWWidths: number[];
  applicableFunctionalClasses: FunctionalClass[];
  elements: Omit<CrossSectionElement, 'id'>[];
  tags: string[];
}
```

---

## Risks + Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Type definition churn after Round 0 | High | Over-specify types with escape hatches (`variant`, `metadata`). Lead controls all type changes. |
| SVG-to-PDF conversion fidelity | Medium | Agent C spikes SVG-to-PDF in Round 1 (2 hours). Fallback: rasterize SVG to PNG for PDF. |
| Standards data accuracy (NACTO/PROWAG) | High | Domain expert reviews all JSON values against source documents. Every entry has page/section citation. |
| Integration conflicts at WS4 hub | Medium | Clear file ownership. WS4 owns store/UI exclusively. Others provide pure functions. |
| Accessibility gaps found late | High | Build accessible from day 1: ARIA in Round 1, keyboard nav in WS4, alt text in WS2. |

---

## Verification

1. **Unit tests**: WS1 validator + WS3 adapter (run with `npm test`)
2. **Visual QA**: Create a 60' 4-lane street, apply road-diet template, verify SVG renders correctly with before/after
3. **Standards check**: Manually verify 5 PROWAG constraints produce correct pass/fail on edge-case widths
4. **PDF export**: Generate PDF, confirm cross-section image, width table, citations, and disclaimer are all present and readable
5. **Accessibility**: Tab through entire editor with keyboard only; verify screen reader announces all elements and validation results
6. **Edge cases**: Try a 30' ROW (too narrow for most templates), verify clear infeasibility message
7. **Deploy**: Push to Vercel, confirm preview URL works end-to-end
8. **Hero examples**: Build 3 pre-configured street designs demonstrating road diet, protected bike lane, and transit priority
