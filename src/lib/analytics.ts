import posthog, { type BeforeSendFn, type Properties } from 'posthog-js';

let initialized = false;

// Report drafts and checkout redirects can contain private query parameters.
const sanitizeUrls: BeforeSendFn = (event) => {
  if (!event) return null;
  for (const properties of [
    event.properties,
    event.properties.$set,
    event.properties.$set_once,
    event.$set,
    event.$set_once,
  ]) {
    if (!properties) continue;
    for (const [name, value] of Object.entries(properties)) {
      if (/(\$|_)(url|referrer)$/.test(name) && typeof value === 'string') {
        properties[name] = value.split(/[?#]/, 1)[0];
      }
    }
  }
  return event;
};

/** Initialize the browser client once before React renders. */
export function initializeAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY?.trim();
  if (!key || initialized) return;

  try {
    posthog.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
      defaults: '2026-05-30',
      capture_pageview: 'history_change',
      capture_pageleave: true,
      person_profiles: 'identified_only',
      autocapture: false,
      disable_session_recording: true,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      save_campaign_params: false,
      before_send: sanitizeUrls,
    });
    initialized = true;
  } catch {
    console.warn('PostHog could not initialize. The app will continue without analytics.');
  }
}

/** Analytics must not turn a successful user action into a reported failure. */
export function captureAnalytics(event: string, properties?: Properties): void {
  if (!initialized) return;
  try {
    posthog.capture(event, properties);
  } catch {
    console.warn('PostHog could not capture an event.');
  }
}

/** Use only the opaque backend ID; never send session tokens or contact details. */
export function identifyAnalytics(userId?: string): void {
  if (!initialized) return;
  try {
    // Check persisted SDK identity too, so a reload cannot merge different users.
    const previousId = posthog.get_property('$user_id');
    if (previousId === userId) return;
    if (previousId) posthog.reset();
    if (userId) posthog.identify(userId);
  } catch {
    console.warn('PostHog could not update the analytics identity.');
  }
}
