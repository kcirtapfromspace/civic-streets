# Local environment

Local configuration lives in the **Curbwise - Development** 1Password Environment.
Use `.env.example` as the variable-name reference; it contains no credentials.

1. Open the Environment in the 1Password desktop app and add or update values.
2. Connect a local `.env` file at the root of your checkout. Preserve and import
   any existing local configuration before replacing a file at that path.
3. Keep 1Password running and authorize access when starting the application.
4. Restart the dev server after changing environment values.

Vite ignores watcher events for the mounted `.env` to prevent restart loops.
Both `.env` and `.env*.local` are ignored by Git. Avoid duplicate settings in
`.env.local`, whose values take precedence over `.env`.

For PostHog, set `VITE_POSTHOG_KEY` to the browser project key. The US ingestion
host is `https://us.i.posthog.com`; EU projects use `https://eu.i.posthog.com`.
All `VITE_` variables can be exposed to the browser, so personal API keys and
server secrets must not use that prefix.

The app initializes PostHog before rendering when `VITE_POSTHOG_KEY` is nonempty.
It captures the initial page view, browser route changes, and page leaves.
Once the anonymous backend session is ready, its opaque user ID identifies the
analytics session. Contact details and session tokens are never sent by this
identity integration. Changing users resets the previous PostHog identity.
Form/click autocapture and session recordings are disabled. Unhandled errors and
promise rejections are captured, but console errors are not. URL query strings
and fragments are removed from event URL properties, including initial and
session-entry URLs. Campaign parameter capture is disabled in SDK configuration.
Without a key, analytics stays disabled and the app works normally.

Product events cover submitted issue reports, saved designs, votes, completed
street/intersection proposals, PDF exports, opened email drafts, government
onboarding requests, checkout starts, and sales contact clicks. Their properties
use categories and counts rather than report text, addresses, or contact details.
Analytics failures do not interrupt these actions.

After saving the key, restart `npm run dev` and browse between pages. In PostHog's
Activity view, check for `$pageview` events with the expected `$pathname`. Local
visits are captured too, so use a separate project key if you want to separate
development traffic. Hosted builds require these variables at build time and a
rebuild after any change; the browser cannot read a local 1Password mount.

The local mount does not configure hosted builds or Convex deployment secrets.
Configure those separately in their respective hosting environments.

References: [1Password local .env files](https://www.1password.dev/environments/local-env-file/),
[Vite environment variables](https://vite.dev/guide/env-and-mode),
[PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config).
