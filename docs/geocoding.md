# Shared geocoding

The application sends submitted place searches and deliberate map selections to Convex. It does not call a public geocoder directly or request suggestions on every keystroke. Search errors stay visible; reverse lookup failures leave coordinate locations or an unnamed road.

## Nationwide ZIP search and pilot reporting

US five-digit ZIP codes use a structured postal-code lookup limited to the US and its territories, without a reporting-area or viewport restriction. Leading zeroes are preserved; ZIP+4 input resolves to its five-digit area. Other place and address searches retain free-text lookup. Results depend on provider data; this is not a complete USPS delivery-point directory.

Reporting is independently restricted to the Chicago, Denver, and New York City pilot envelopes in `shared/reporting-areas.ts`. NYC includes all five boroughs. As with the existing Chicago and Denver pilots, these rectangular envelopes are approximate community coverage, not municipal boundaries. The backend rejects reports outside these areas; map, issue-form, report-detail, and representative-wizard controls also gate reporting. Searching or designing elsewhere stays available.

## Operator configuration

Set **GEOCODING_BASE_URL** in the backend environment after selecting a provider and accepting its terms. It must be a Nominatim-compatible HTTPS origin, optionally ending in `/nominatim/`. Credentials, query strings, redirects, local/IP destinations, custom ports, and arbitrary paths are rejected. No upstream is selected by default. `VITE_CONVEX_URL` connects the frontend to Convex; no geocoder key belongs in the browser.

For the public OpenStreetMap Nominatim service, explicitly review its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) before configuring `https://nominatim.openstreetmap.org`. Its application-wide limit is one request per second, autocomplete is forbidden, use must be moderate and triggered by users, attribution must be visible, and operators must be able to switch providers. Do not send confidential information. This implementation is specific to Curbwise; it is not a generic geocoding service for other applications.

Switching a compatible provider requires changing the backend environment value. The cache includes the provider URL, so changing providers does not reuse the former provider's cached results. A noncompatible commercial provider needs a server adapter; this patch does not provision one or supply billing credentials.

## Controls and limits

- A database-backed global lease permits one upstream request in flight. The next request must wait 1,100ms after completion, including failure. Fetches time out after 10 seconds. A delayed action cannot start with less than 10 seconds remaining in its 30-second lease; a lost lease retains its cooldown before reuse.
- Each validated anonymous session can make 10 requests per minute, including cache hits and busy responses. Session quota keys use user IDs, never stored bearer tokens.
- Searches accept 3–200 characters. Reverse coordinates must be finite and within latitude/longitude bounds; cache keys round them to five decimal places.
- Successful results cache for seven days; genuine empty searches for one hour. HTTP/network/validation failures are never cached as empty results. Response reads are capped at 128 KiB and results at five entries.
- Expired cache and old session limiter records are removed by bounded scheduled cleanup. The global limiter is retained.
- Only `/search` and `/reverse` routes are constructed server-side. Upstream receives a Curbwise User-Agent and no session token. Results are reduced to place ID, label, coordinates, and optional road name.

Anonymous sessions are freely issued; their quotas alone cannot prevent someone creating many sessions. The global lease still bounds upstream traffic. At sustained demand, configure a provider with capacity appropriate to the application rather than increasing public Nominatim traffic.

## Live configuration and rollout — September 21, 2026

- Operator approved public Nominatim for nationwide ZIP search. Set `GEOCODING_BASE_URL=https://nominatim.openstreetmap.org` on `chatty-puffin-875`, the backend confirmed in the live frontend bundle.
- Deployed ZIP-aware search and the Chicago/Denver/NYC backend reporting gate with `npx convex dev --once --typecheck enable --tail-logs disable`. The separate production deployment was not changed.
- Live browser verification: `80211` returned Denver and selected coordinates approximately 39.7665, -105.0203; `02108` returned Beacon Hill, Boston with its leading zero preserved.
- Live backend validation accepted Chicago, Denver, and NYC geography, then stopped on the required-photo check. Boston was rejected by the pilot-area gate. No test reports or messages were published.
- UI gates are implemented and built locally, but publishing them is blocked by an expired Render CLI token (`render login` required). The backend gate is already enforced for the existing frontend.
- Node 24: `npm run check` passed (952 tests, 86 application test files, all 202 production files passing strict coverage, backend typecheck, production build). Coverage baseline ratcheted after the passing run. Scoped lint and diff whitespace checks passed.

## Verification

Backend regression tests cover cache normalization, ownership/session checks, rate spacing across users, quotas, timeouts, malformed responses, provider configuration, cache expiry, and stale-lease safety. Frontend tests verify that requests use Convex without direct-provider fallback and preserve actionable errors. Tests mock upstream responses; no real geocoding requests are needed to run them.
