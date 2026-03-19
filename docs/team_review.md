# Street Copilot: Team Review Synthesis

> Five-perspective analysis conducted 2026-03-19.
> Agents: Product Strategist, Devil's Advocate, Accessibility Advocate, Competition Analyst, Technical Architect.

---

## Executive Summary: What the Team Agrees On

All five perspectives converge on these points:

1. **The gap is real.** There is no tool that combines photo-based input, standards-cited feasibility, and non-expert accessibility. Streetmix proves demand. UrbanistAI proves photo-to-redesign works. Nobody has fused them with engineering credibility.

2. **The PRD builds the hard thing first and validates demand second.** Every reviewer flagged this. The roadmap invests months 2-5 in CV/geometry inference before proving anyone will use the output. **Invert the roadmap: ship Phase 0 in 4-6 weeks, get real users, then invest in automation.**

3. **Accessibility is a hard constraint, not a tradeoff.** ADA/PROWAG compliance is federal law. The Feasibility Engine must enforce it as a floor, not surface it as a slider. Every concept must pass minimum checks before being shown.

4. **Do not fork World Monitor.** The domain gap is too large and the AGPL-3.0 license creates commercial risk. Study the patterns (map + panels + workers), build from scratch with React/Next.js.

5. **The business model is the biggest existential risk.** The PRD has no pricing section. Advocates can't pay. Government procurement is slow. Small planning firms are the most viable early buyers ($79-149/mo).

---

## 1. Product Strategy

### Product-Market Fit

The gap is real but commercially fragile. The people who need this most (advocates) can't pay. The people who can pay (firms, agencies) don't yet know they need it.

**Most viable paying segment:** Small planning/urban design firms. A $100/mo tool that saves 4 hours of junior designer time on concept sketches pays for itself instantly at $150-250/hr billing rates.

**Recommended pricing:**

| Tier | Price | Target |
|------|-------|--------|
| Free | $0 | Advocates, journalists (2 blocks/mo, watermarked) |
| Pro | $99/mo | Small firms, BIDs (unlimited, branded exports) |
| Team | $299/mo (5 seats) | Larger firms, agencies |
| Enterprise | $1K-3K/mo | City DOTs (SSO, custom templates) |

### Critical Missing User Stories

The PRD covers "generate a concept" but ignores everything after:

- **Council meeting story:** Export must look professional, cite specific standards sections, include disclaimers
- **Grant application story:** Align exports with SS4A and RAISE grant requirements -- this alone could drive adoption
- **Engineer pushback story:** Every output needs a "Limitations and Assumptions" section
- **Iteration story:** Users need to tweak, lock elements, regenerate -- not just get 3 static options
- **Share story:** Read-only sharing links needed in Phase 0 (trivial to build, essential for civic use)

### Key Product Decisions

1. **Start as a report generator, not a design tool.** The PDF is the unit of value in civic contexts. Nobody brings a web app to a council meeting.
2. **v1 should have zero AI under the hood.** Deterministic standards checking + good UI. Add CV in Phase 1 after validating output value.
3. **Phase 0 should be cross-section only, not block-level.** Plan view and intersection geometry are Phase 2+.
4. **Open-source the Treatment Library + Standards Engine.** Keep the app proprietary. "Open core" model builds trust and community contribution.
5. **U.S.-only for standards checking; international for the basic tool.**

---

## 2. Devil's Advocate: Stress Test Results

### Assumptions Ranked by Risk

| Assumption | Verdict | Key Concern |
|------------|---------|-------------|
| Photo-to-geometry is feasible for v1 | **Serious risk / near deal-breaker** | Uncalibrated phone photos can't produce metric measurements. Skip CV for Phase 0. |
| This can be a business | **Serious risk** | Civic tech has a brutal monetization track record. No pricing model in PRD is a red flag. |
| One-block scope is the right wedge | **Serious risk** | A bike lane that starts and ends in one block is a "gap." Must show network context even if not solving it. |
| Non-experts need this tool | **Serious risk** | If the real bottleneck is political will (not technical credibility), this solves the wrong problem. |
| Standards trace creates credibility | **Manageable** | Could backfire if it triggers defensive "playing engineer" reaction from city staff. Frame as "conversation starter, not engineering document." |
| 3 concepts is the right number | **Manageable** | Should be defaults on a spectrum, not the only outputs. Filter irrelevant concepts (no transit option if no bus route). |
| World Monitor is a good foundation | **Manageable** | Decide in 2 weeks. The AGPL question needs a clear answer before production code. |
| The SimCity comparison resonates | **Manageable** | Use in investor pitches, never in user-facing material. "Canva for street design" is better consumer framing. |

### The 3 Things Most Likely to Kill This Product

1. **Building hard tech before validating demand.** Ship Phase 0 in weeks, not months.
2. **The credibility uncanny valley.** Too technical for casual advocates, too informal for engineers. Pick a lane.
3. **No one pays.** Need a revenue hypothesis before writing production code.

### The 3 Things That Make It Worth Building Anyway

1. The gap between "napkin sketch" and "$200K corridor study" is real and politically significant.
2. Federal infrastructure funding (IIJA/BIL) + Complete Streets mandates create a historic window.
3. AI has genuinely changed what's possible -- LLM + rules engine hybrid can produce novel, useful output.

---

## 3. Accessibility Review

### Critical Architectural Decision

**Accessibility must be a HARD CONSTRAINT in the Feasibility Engine, not a tradeoff dimension in the Tradeoff Engine.**

- ADA/PROWAG compliance is federal law, not a design preference
- A concept that fails ADA is not "less accessible" -- it is illegal if built
- The tool's own value proposition ("concepts that survive planner review") requires ADA compliance
- Analogy: building code checkers don't let you "dial down" structural integrity

**Implementation:** Every concept passes minimum ADA/PROWAG checks before display. If a concept can't meet minimums within the available ROW, flag it as infeasible rather than silently degrading accessibility.

**Solver priority order:**
1. Reserve minimum pedestrian access route (48" absolute, 60" preferred)
2. Reserve ADA-compliant curb ramp landings at all crossings
3. Reserve minimum bus stop boarding areas (96"x60", 2% max cross-slope)
4. Allocate remaining width to travel lanes, bike facilities, parking, buffers

### Dimension 1: Tool Accessibility (Can disabled users USE the tool?)

**Priority 1 (v1):**
- Address text input as primary location method (not secondary to map pin-drop)
- Structured text cross-section descriptions auto-generated from layout data
- Alt text on every diagram/rendering, auto-generated from computed layout
- Width allocation as real HTML tables, not images
- Full keyboard navigation (WCAG 2.1.1)
- ARIA-compliant priority selection (no inaccessible custom sliders)
- Text-based geometry review + correction path
- No color-only encoding in diagrams (WCAG 1.4.1)

**Highest WCAG risks:** 1.1.1 Non-text Content (critical), 2.1.1 Keyboard (critical), 4.1.2 Name/Role/Value (critical), 1.4.1 Use of Color (high).

### Dimension 2: Street Design Accessibility (Are the DESIGNS accessible?)

**Required PROWAG checks in the Feasibility Engine:**
- Pedestrian Access Route: 48" min clear width, 60" passing spaces, 2% max cross-slope
- Curb ramps: required at every crossing, 8.3% max slope, 48"x48" landing, detectable warnings
- Bus stop boarding areas: 96"x60" min, 2% max cross-slope, connected to PAR
- Floating bus stops: auto-flag need for tactile guidance across bike lane
- Refuge islands: must include accessible cut-throughs with detectable warnings

**Missing treatments to add:**
- Curb ramps (auto-placed at every crossing as hard requirement)
- Detectable warning surfaces (truncated domes)
- Accessible pedestrian signals
- Level boarding platforms at bus stops
- Accessible loading zones (60" wide x 240" long access aisle)

### Anti-Patterns to Avoid

1. Don't ship non-ADA-compliant concepts and "add accessibility later"
2. Don't frame accessibility vs. bikes as zero-sum
3. Don't produce visual-only outputs (excludes disabled advocates from civic participation)
4. Don't use a green "ADA compliant" checkmark without showing specific checks performed
5. Don't present shared-space designs without warnings about risks to blind pedestrians
6. Don't present floating bus stops without mitigation requirements
7. Don't design accessibility features without disabled user testing ("Nothing about us without us")
8. Don't allocate sidewalk as "leftover space" after lanes -- allocate pedestrian space FIRST

---

## 4. Competitive Landscape

### The White Space Is Real

```
                    NON-EXPERT USER
                         |
    UrbanistAI           |
                         |      *** STREET COPILOT ***
    Transform            |         (target position)
    Your City            |
                         |
    Streetmix    StreetPlan
                         |
    3DStreet             |
SIMPLE -------------------+------------------- COMPLEX
                         |
    A/B Street           |
                         |      Remix Streets
    PeopleForBikes       |      Replica
                         |      ArcGIS Urban
                         |      InfraWorks
                    EXPERT USER
```

**Nobody occupies the upper-right quadrant** (sophisticated + accessible). UrbanistAI is closest but lacks engineering rigor.

### Top Competitive Threats

| Competitor | Threat Level | Why |
|------------|-------------|-----|
| **3DStreet** | HIGH | Actively adding AI (May 2025 AI Assistant, Sep 2025 AI rendering). Has Streetmix ecosystem as distribution. If they add photo input + standards engine, direct competition. |
| **UrbanistAI** | HIGH | Already does photo-to-redesign for participatory planning. If they add engineering validation, direct competition. |
| **Remix/Via** | MEDIUM-HIGH | Has government sales channel. Could build/acquire AI visualization layer. |
| **StreetPlan** | LOW | Already has standards feedback (ITE/CNU red/yellow/green) but no AI, limited development momentum. |
| **Streetmix** | MEDIUM | Massive brand, beloved, but financially fragile ($1.7K/mo vs $5K target) and architecturally stagnant. |

### Strategic Recommendations from Competitive Analysis

1. **Lead with credibility, not beauty.** UrbanistAI and Transform Your City already make pretty pictures. Street Copilot's wedge is standards-cited, dimensioned, feasible output.
2. **Build Streetmix import immediately.** Position as "the next step after Streetmix" not a replacement.
3. **Prioritize grant-application use case.** SS4A/RAISE grants require concept feasibility docs. No competitor serves this.
4. **Pursue 3DStreet partnership** before they build upstream. Street Copilot does AI redesign, 3DStreet does 3D/AR visualization.
5. **Build the standards compliance engine as the moat.** This is what Maket did with zoning codes (1M+ users, $30/mo). Hard to replicate, durable advantage.

### Pricing Intelligence

- Streetmix: free ($5/mo premium)
- 3DStreet: free / $5K/yr Pro
- Maket (analogous AI design tool): free / $30/mo Pro
- TestFit: $100-667/mo
- Remix: $50-200K/yr enterprise

Maket's 1M users at $30/mo validates that "AI + regulatory compliance + non-expert users" is a viable category.

---

## 5. Technical Architecture

### Key Technical Decisions

| Decision | Recommendation | Confidence |
|----------|---------------|------------|
| Fork World Monitor? | **No. Inspire only.** | High |
| UI framework | **React (Next.js 14+ App Router)** | High |
| CV approach (v1) | **Claude Vision API with structured output** | High |
| CV approach (v2) | **Add Depth Anything V2 via Transformers.js** | Medium |
| Layout engine | **Hybrid template + constraint solver** | High |
| Cross-section rendering | **SVG with @streetmix/illustrations** | High |
| Map library | **MapLibre GL JS (BSD-3, no vendor lock-in)** | High |
| Standards storage | **Version-controlled JSON in repo** | High |
| 3D for v1? | **No** | High |
| Deployment | **Vercel** | High |
| Cache | **Upstash Redis** | High |

### Architecture (v1)

```
CLIENT (Browser)
  React (Next.js) + Zustand (state w/ undo/redo)
  SVG cross-section editor (@streetmix/illustrations)
  MapLibre GL + deck.gl (plan view)
  Web Worker (Phase 2: Depth Anything V2 ONNX)
        |
        v  HTTPS
API LAYER (Vercel Serverless)
  /api/analyze -- orchestrates CV pipeline
  /api/design  -- layout engine + constraint solver
  /api/standards -- query standards by element/city
        |
   +---------+-----------+
   v         v           v
Claude    Layout       Standards DB
Vision    Engine       (JSON in repo)
API       30-40        NACTO, PROWAG,
          templates    FHWA, MUTCD
   |
   v
External Data: OSM Overpass, Transitland (GTFS),
Google Street View, Census TIGER, FHWA HPMS
```

### CV Pipeline (v1): LLM-First, Not CV-First

```
User photos + address
  |
  v
Claude Vision API -- structured output prompt:
  "Identify all cross-section elements left to right.
   Estimate relative proportions."
  |
  v
Structured JSON: { elements: [{type, relativeWidth, side}...] }
  |
  v
Width Resolver -- query OSM/municipal data for total ROW width
  Allocate absolute widths from relative proportions
  Validate against NACTO minimums
  |
  v
Street Geometry Model -- absolute dimensions per element
```

**Cost:** ~$0.03-0.06 per analysis (6-12 photos at Claude Sonnet pricing). ~$300-600/mo at 10K analyses.

**Accuracy target:** Element identification 90%+. Width estimation +/- 2 feet (combined with ROW data). "Good enough" for concept generation, not construction docs.

### Layout Engine Data Model

```typescript
interface StreetSegment {
  totalROWWidth: number;       // feet
  curbToCurbWidth: number;
  direction: 'one-way' | 'two-way';
  functionalClass: 'local' | 'collector' | 'minor-arterial' | 'major-arterial';
  elements: CrossSectionElement[];
}

interface CrossSectionElement {
  type: ElementType;  // 'sidewalk' | 'bike-lane' | 'travel-lane' | 'parking-lane' | ...
  side: 'left' | 'right' | 'center';
  width: number;
  constraints: {
    absoluteMin: number;      // hard minimum (ADA/PROWAG)
    recommendedMin: number;   // NACTO recommended min
    recommended: number;
    source: string;           // "NACTO USDG p.42"
  };
}
```

**Solver approach:** Template library (30-40 archetypes) + parametric constraint solver that adjusts templates to fit actual ROW width. Hard constraints (ADA) enforced first, then soft constraints (NACTO recommendations) optimized.

### Build Sequence

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| **Technical Spike** | Weeks 1-2 | Upload photos + address, get structured JSON cross-section. Validates CV pipeline before further investment. |
| **MVP** | Weeks 3-8 | Cross-section data model + standards DB (NACTO, PROWAG). Layout engine with 10 templates. SVG renderer. Photo upload + map. 3 concepts. Sharing. |
| **Polish** | Weeks 9-14 | Interactive editing (drag-resize lanes). 20+ templates. Tradeoff analysis. PDF export. Depth estimation enhancement. |
| **Scale** | Weeks 15-20 | City overlays (3 cities). GTFS integration. User accounts. Community gallery. API. |

### Minimum Team: 3 People

| Role | Focus |
|------|-------|
| Full-stack engineer (lead) | React, Next.js, SVG renderer, API routes, deployment |
| ML/CV engineer | LLM prompt engineering, structured output, Phase 2 depth estimation |
| Domain expert / product | Standards database, template library, constraint logic, user testing |

**Hardest hire:** ML/CV engineer who understands both LLM structured output AND traditional CV for Phase 2.

### Top 5 Technical Risks

1. **CV pipeline accuracy** (Critical) -- Validate in weeks 1-2 spike. Fallback: manual input.
2. **Street width data availability** (High) -- OSM tags are sparse. Always ask user. Use heuristics with uncertainty bounds.
3. **Standards encoding correctness** (Medium) -- Liability risk. Get PE review before launch. PROWAG = always hard constraint.
4. **User-facing complexity** (Medium) -- Plain language, guided wizard, progressive disclosure.
5. **Rendering performance** (Low) -- SVG handles 15-20 elements easily; fallback to Canvas for interactive editing if needed.

---

## 6. Cross-Cutting Recommendations

### What All Five Perspectives Agree Should Change in the PRD

1. **Add a pricing/business model section.** Revenue hypothesis before production code.
2. **Redefine Phase 0 as "Credible Report Generator."** Manual width input, template selection, standards check, professional PDF. Ship in 4-6 weeks. No photos, no CV, no map.
3. **Add Phase 0.5 ("Address-Grounded, User-Measured").** User enters address, sees real imagery, manually traces geometry. Validates "real-world grounding" without CV investment.
4. **Move ADA/PROWAG from Tradeoff Engine to Feasibility Engine as hard constraint.**
5. **Add "Limitations and Assumptions" section to every output.** Legal and trust necessity.
6. **Add shareable read-only links to Phase 0.** Trivial to build, essential for civic distribution.
7. **Add grant-application export format (SS4A/RAISE alignment).**
8. **Add iteration/editing user story.** Lock elements, adjust parameters, regenerate.
9. **Add network context.** Even in one-block scope, show what connects on adjacent blocks.
10. **Add competitive positioning section.**

### Recommended Revised Roadmap

**Phase 0: "Streetmix with Standards" (Weeks 1-6)**
- Manual width entry or common profile selection (60', 66', 80', 100')
- Template gallery (not auto-generated concepts)
- NACTO + PROWAG dimensional feasibility check
- Clean SVG cross-section with before/after
- Professional PDF export with standards citations + disclaimers
- Shareable read-only link
- ADA/PROWAG as hard constraint
- No photos, no CV, no map, no AI
- **Goal:** Validate that advocates/planners find standards-grounded reports valuable

**Phase 0.5: "Address-Grounded" (Weeks 7-12)**
- Address entry with geocoding
- Display real street imagery alongside editor
- User manually traces geometry (guided)
- MapLibre plan view showing block in context
- Network context overlay (adjacent bike/transit infrastructure)
- **Goal:** Validate that real-world grounding changes user behavior

**Phase 1: "AI Copilot" (Weeks 13-20)**
- Claude Vision photo analysis pipeline
- Auto-inferred geometry with user correction
- 3 auto-generated concepts (transit-first, bike-first, balanced)
- Tradeoff analysis
- GTFS transit context
- User accounts, saved designs
- **Goal:** Validate that AI inference is accurate enough and that auto-concepts are better than manual template selection

**Phase 2: "Professional" (Weeks 21-30)**
- Interactive drag-resize cross-section editor
- City-specific overlays (3 cities)
- Improved CV (Depth Anything V2 in-browser)
- Corridor support (multi-block)
- Collaboration features
- API for third-party integrations

---

## Appendix: Individual Agent Reports

Full reports from each agent are available in the task output files. Key sections:

- **Product Strategist:** PMF assessment, 7 missing user stories, GTM channels, moat analysis, 10 PRD change recommendations
- **Devil's Advocate:** 10 assumptions stress-tested with verdicts, 3 kill scenarios, 3 reasons to build anyway
- **Accessibility Advocate:** PROWAG/ADA compliance checks, WCAG risk matrix, 42 prioritized recommendations, 8 anti-patterns
- **Competition Analyst:** 20 competitors profiled with web research, market map, pricing intelligence, 7 strategic recommendations
- **Technical Architect:** Architecture diagram, CV pipeline design, layout engine data model, standards DB structure, build sequence, team composition, 5 technical risks
