# Shared geocoding

The application sends submitted place searches and deliberate map selections to Convex. It does not call a public geocoder directly or request suggestions on every keystroke. Search errors stay visible; reverse lookup failures leave coordinate locations or an unnamed road.

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

## Verification

Backend regression tests cover cache normalization, ownership/session checks, rate spacing across users, quotas, timeouts, malformed responses, provider configuration, cache expiry, and stale-lease safety. Frontend tests verify that requests use Convex without direct-provider fallback and preserve actionable errors. Tests mock upstream responses; no real geocoding requests are needed to run them.
