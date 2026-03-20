# Curbwise -- Founder PRD

## 1. Product Overview

Curbwise is an AI-assisted street design tool that converts
real-world inputs (photos + location) into feasible, standards-aware
street redesign concepts for transit, walking, and biking.

**Core Value:**\
Enable non-experts to generate credible, constraint-aware street design
concepts that can survive initial review by planners and engineers.

------------------------------------------------------------------------

## 2. Goals & Non-Goals

### Goals

-   Generate 2--3 feasible street redesign concepts from real-world
    inputs
-   Provide width allocations and standards-based validation
-   Communicate tradeoffs clearly (parking, transit, safety, etc.)
-   Export outputs usable in public meetings and early planning
    workflows

### Non-Goals (v1)

-   Full CAD drawings
-   Traffic microsimulation
-   Signal timing optimization
-   Utility/drainage engineering
-   Nationwide code coverage

------------------------------------------------------------------------

## 3. Target Users

### Primary

-   Neighborhood advocates
-   Safe streets groups
-   Council staff
-   Small urban design firms

### Secondary

-   City planners (early-stage concepting)
-   Journalists / researchers

------------------------------------------------------------------------

## 4. Core User Stories

### Advocate

-   As an advocate, I upload photos of my street and get redesign
    options I can present to my city.

### Planner

-   As a planner, I want quick concept alternatives that respect basic
    design standards before committing to CAD.

### Council Staff

-   As a staffer, I need clear visuals and tradeoffs to communicate
    proposals to constituents.

------------------------------------------------------------------------

## 5. User Flow (v1)

1.  Enter address or drop pin\
2.  Upload photos (6--12 images)\
3.  System infers street geometry\
4.  User selects priorities:
    -   Bus speed
    -   Bike safety
    -   Pedestrian safety
    -   Preserve parking
5.  System generates 3 concepts:
    -   Transit-first
    -   Bike-first
    -   Balanced
6.  Outputs:
    -   Before/after visuals
    -   Width allocation diagram
    -   Tradeoffs
    -   Standards trace
7.  Export report

------------------------------------------------------------------------

## 6. System Components

### 6.1 Street Understanding Engine

-   Computer vision + user correction
-   Detect lanes, curbs, sidewalks, parking, bus stops

### 6.2 Feasibility Engine

-   Deterministic layout solver
-   Fits treatments within right-of-way constraints

### 6.3 Treatment Library

-   Road diet
-   Protected bike lanes
-   Bus lanes / queue jumps
-   Curb extensions
-   Refuge islands
-   Parking/loading reallocation

### 6.4 Standards Engine

-   NACTO
-   FHWA
-   PROWAG / ADA
-   MUTCD (basic compliance layer)

### 6.5 Tradeoff Engine

-   Explains impacts:
    -   Parking loss
    -   Travel time changes (qualitative)
    -   Safety improvements
    -   Accessibility

### 6.6 UI Layer

-   Map-centered interface
-   Scenario comparison
-   Editable geometry panel

------------------------------------------------------------------------

## 7. Outputs

Each concept includes: - Visual rendering - Cross-section diagram -
Width allocation table - Tradeoff summary - Standards justification -
Uncertainty flags

------------------------------------------------------------------------

## 8. Key Risks

### Trust Risk

Mitigation: Show standards trace + editable assumptions

### Accuracy Risk

Mitigation: Confidence scores + user overrides

### Political Risk

Mitigation: Surface tradeoffs explicitly

### Data Risk

Mitigation: Use user-uploaded imagery (avoid restrictive APIs)

------------------------------------------------------------------------

## 9. Metrics

### Product

-   \% of sessions generating usable concepts
-   Time to first concept (\<2 min target)
-   Export rate

### Adoption

-   # of reports used in real meetings

-   Repeat usage per user

------------------------------------------------------------------------

## 10. Roadmap

### Phase 0 (0--2 months)

-   Static street templates
-   Manual width input
-   Basic UI + export

### Phase 1 (2--5 months)

-   Photo ingestion
-   Geometry inference (semi-automated)
-   3 scenario generator
-   Standards checks (basic)

### Phase 2 (5--9 months)

-   Improved CV accuracy
-   Editable geometry UI
-   Tradeoff explanations
-   City-specific overlays

### Phase 3 (9--15 months)

-   Corridor support (multi-block)
-   Collaboration features
-   Planner mode (detailed review)
-   Integration with GIS exports

------------------------------------------------------------------------

## 11. Positioning

Not a CAD tool.\
Not a simulation engine.

**Positioning:**\
A "first-draft street design compiler" that bridges public imagination
and engineering reality.
