# Public data sources and credits

Reviewed September 21, 2026 against the application source. This inventory describes integrations in the repository; it does not establish which optional providers are enabled in production. Linked source pages were retrieved during this review unless an exception is stated below. A working source page does not guarantee continuous API availability.

## Disclosure

Curbwise uses third-party maps, imagery, routing results, municipal crash records, public government contact information, and selected published street-design guidance. We credit the publishers below. Curbwise filters and reformats some of this information for display. Community reports and proposed street designs are contributed or created within Curbwise; they are not official city records. Source coverage, completeness, update schedules, and precision vary. An empty or unavailable map layer does not establish that no crashes occurred. Inclusion of a source does not imply its publisher endorses Curbwise.

## Maps, imagery, and location

| Source and working link | What Curbwise uses | Connection and limitations |
| --- | --- | --- |
| [OpenStreetMap contributors — source and copyright](https://www.openstreetmap.org/copyright) | Street-map raster tiles in the main map and community minimap. | Connected to `tile.openstreetmap.org`. Credit OpenStreetMap contributors; the underlying map data is ODbL licensed. Map data is community maintained, not a survey of actual street dimensions. |
| [Esri World Imagery — service metadata](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson) | Satellite/aerial background tiles. | Connected for satellite and hybrid map modes. Imagery dates, resolution, and contributing providers vary by location. Publisher metadata contains credits and service information; public accessibility does not mean public-domain imagery. |
| [Esri World Boundaries and Places — service metadata](https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer?f=pjson) | Place and boundary labels over satellite imagery. | Connected in hybrid mode. These labels do not establish the municipal jurisdiction of a report. |
| [Project OSRM — official project and documentation](https://github.com/Project-OSRM/osrm-backend) | Route geometry for aligning proposed street segments to roads. | Connected to `router.project-osrm.org/route/v1/driving`. OSRM uses OpenStreetMap data. The app requests driving routes; output is not measured curb geometry or a bicycle/pedestrian safety recommendation. |
| [Nominatim public-service policy](https://operations.osmfoundation.org/policies/nominatim/) and [OpenStreetMap credits](https://www.openstreetmap.org/copyright) | Place/address search, reverse lookup, and road names through a Nominatim-compatible provider. | Conditional: `GEOCODING_BASE_URL` must be configured; no provider is selected by default. Production provider was not inspected. Public Nominatim requires an explicit operator choice, attribution, an application-wide maximum of one request per second, and no autocomplete. Successful results are cached for seven days; empty searches for one hour. See [geocoding configuration](geocoding.md). |

Implementation: `src/features/map/useMapLibre.ts`, `src/features/community/ExplorerMinimap.ts`, `src/features/proposal/utils/road-snap.ts`, `src/features/proposal/utils/road-geometry.ts`, and `convex/geocoding.ts`.

## Municipal crash records

| Publisher and working source link | Data consumed | Curbwise handling and limits |
| --- | --- | --- |
| City and County of Denver / Denver Police Department: [Traffic Accidents, ArcGIS layer 325](https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325) | Incident identifiers, coordinates, occurrence dates, bicycle/pedestrian involvement, fatalities, and serious injuries. | Connected. Adapter requests the previous five calendar years plus the current year to date. Publisher says records are updated weekdays and can be revised. Paginates up to 20,000 rows and deduplicates incidents. Other injury severity remains unknown; involvement flags do not identify who was injured. |
| Chicago Police Department / Chicago Data Portal: [Traffic Crashes — Crashes](https://data.cityofchicago.org/Transportation/Traffic-Crashes-Crashes/85ca-t3if) | Crash identifiers, coordinates, dates, injury/fatality totals, most severe injury, and first crash type. | Connected; dataset ID `85ca-t3if`. Requests at most 1,000 newest matching records per view. Mode is inferred from first crash type. The adapter labels unmatched severity values as minor, so that label should not be interpreted as an independently verified clinical severity classification. |
| NYPD / NYC Open Data: [Motor Vehicle Collisions — Crashes](https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95) | Collision identifiers, coordinates, dates, and injury/fatality counts by road-user group. | Connected; dataset ID `h9gi-nx95`. Requests at most 1,000 newest matching records per view. Injury counts do not establish injury severity; nonfatal records are classified as unknown. Modes derive from casualty fields and are not a complete inventory of involved road users. |

All three adapters filter by requested map bounds and dates, normalize records into a shared format, and omit unusable coordinates. Successful queries are cached in memory for five minutes. Municipal datasets do not establish coverage of surrounding municipalities. The app exposes source failures and partial-result warnings. These layers are records of reported crashes, not a complete measure of exposure or street safety.

Implementation: `src/features/safety-data/api/` and `src/features/safety-data/CrashCoverageStatus.tsx`.

## Government contacts and civic services

| Source and working link | Use and status |
| --- | --- |
| [Denver City Council contact directory](https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Denver-City-Council/Contact-Information) | Source for the bundled Denver office contacts. The code records verification on September 14, 2026 and stops offering those saved selections on December 13, 2026. Residents select/confirm an office. This review verified the source page, not every contact value. |
| [Denver council district map](https://www.denvergov.org/maps/map/councildistricts) | External reference for residents choosing an office. Curbwise does not ingest its district polygons or automatically establish a resident's district through this link. |
| [Portland City Council](https://www.portland.gov/council), [Chicago City Council](https://www.chicago.gov/city/en/about/council.html), [NYC City Council](https://council.nyc.gov/), and Denver's directory above | The backend includes on-demand public-contact discovery from configured municipal and transportation websites in these cities. It extracts public email/phone details and retains the originating page URL. Discovered contacts need their individual source URL disclosed; this list is not a substitute for record-level provenance. No production discovery run was performed in this review. |
| [Chicago 311 public portal](https://311.chicago.gov/) | An Open311 adapter is configured to read service codes/names/descriptions and submit reports. **Availability exception:** its configured `311api.cityofchicago.org` services endpoint failed TLS hostname validation during this review. The linked public portal works, but the API must not be described as verified operational. |

Other city 311 links are destinations for residents to complete a submission, not imported public datasets. A SeeClickFix adapter exists, but no city is routed to it in the current civic-service configuration. Its presence does not establish active data consumption.

Implementation: `src/features/report/official-contacts.ts`, `convex/governmentShared.ts`, `convex/governmentActions.ts`, and `src/lib/api/civic/`.

## Published guidance and bundled assets

| Source and working link | What is incorporated |
| --- | --- |
| [NACTO Urban Street Design Guide](https://nacto.org/publication/urban-street-design-guide/) | Locally encoded dimensional guidance, constraints, and template references. `data/standards/nacto.json` labels its version “NACTO USDG 2013.” This is Curbwise's selected interpretation, not a live NACTO feed; individual values and page citations were not revalidated in this inventory. |
| [U.S. Access Board — Public Right-of-Way Accessibility Guidelines](https://www.access-board.gov/prowag/) | Selected accessibility checks in `data/standards/prowag.json`, labeled “PROWAG 2023.” These limited checks do not establish full accessibility or engineering compliance. |
| [Streetmix illustrations](https://github.com/streetmix/illustrations) | Bundled street illustration assets. `public/illustrations/LICENSE` identifies `@streetmix/illustrations` v2.1.3 under CC BY-SA 4.0. Preserve those credits and disclose asset modifications when applicable. These are third-party artwork, not observed street data. |

The application also loads the Plus Jakarta Sans font through Google Fonts. This is a presentation asset rather than a public civic dataset. Community submissions, locally authored templates, demonstration fixtures, and rectangular pilot-area bounds must not be represented as imported official measurements or municipal boundary data.

## References that are not connected datasets

The NHTSA FARS module explicitly reports national crash coverage as unconnected. It links to `https://cdan.dot.gov/query` as an external reference; this URL returned HTTP 403 during verification and is not counted as a verified working source link. Do not claim that Curbwise currently consumes a nationwide FARS crash feed.

## Disclosure placement and maintenance

This document is the repository disclosure inventory; it has not been published as an application page. Existing map attribution and crash-source links cover parts of the inventory. A public “Data sources & credits” page should expose this information from the site footer and map; exported reports should carry the sources actually used, retrieval dates, and any partial-coverage warnings. Esri contributor credits and Streetmix artwork credits also need visibility in the relevant display/export surfaces.

For each added or changed integration, update publisher, working source link, fields consumed, connection status, transformations, limits, attribution, and verification date here. Keep deployment-specific provider choices accurate and distinguish source-page checks from API tests and record-level validation.
