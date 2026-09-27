import type { BeforeSendFn, CaptureResult, PostHogConfig } from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { init, capture, identify, reset, getProperty } = vi.hoisted(() => ({
  init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), getProperty: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: { init, capture, identify, reset, get_property: getProperty } }));

beforeEach(() => {
  vi.resetModules();
  init.mockReset();
  capture.mockReset();
  identify.mockReset();
  reset.mockReset();
  getProperty.mockReset();
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_project');
  vi.stubEnv('VITE_POSTHOG_HOST', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function startAnalytics() {
  const { initializeAnalytics } = await import('../analytics');
  await initializeAnalytics();
  return init.mock.calls[0][1] as PostHogConfig;
}

describe('optional PostHog startup', () => {
  it.each([undefined, '', '   '])('does not start analytics with an absent or blank key (%s)', async (key) => {
    vi.stubEnv('VITE_POSTHOG_KEY', key);
    const { initializeAnalytics } = await import('../analytics');
    await initializeAnalytics();
    expect(init).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enables SPA page views and unhandled errors without recording forms or sessions', async () => {
    const config = await startAnalytics();
    expect(init.mock.calls[0][0]).toBe('phc_test_project');
    expect(config).toMatchObject({
      api_host: 'https://us.i.posthog.com',
      capture_pageview: 'history_change',
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      person_profiles: 'identified_only',
      save_campaign_params: false,
    });
  });

  it('uses the configured region and trims pasted whitespace', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '  phc_test_project \n');
    vi.stubEnv('VITE_POSTHOG_HOST', ' https://eu.i.posthog.com  ');
    const config = await startAnalytics();
    expect(init.mock.calls[0][0]).toBe('phc_test_project');
    expect(config.api_host).toBe('https://eu.i.posthog.com');
  });

  it('uses the US host when the configured host is blank', async () => {
    vi.stubEnv('VITE_POSTHOG_HOST', '  ');
    expect((await startAnalytics()).api_host).toBe('https://us.i.posthog.com');
  });

  it('shares concurrent initialization and does not create duplicate SDK sessions', async () => {
    const { initializeAnalytics } = await import('../analytics');
    await Promise.all([initializeAnalytics(), initializeAnalytics()]);
    await initializeAnalytics();
    expect(init).toHaveBeenCalledOnce();
  });

  it('contains SDK failure without exposing its error and allows a later retry', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    init.mockImplementationOnce(() => { throw new Error('provider error containing private data'); });
    const { initializeAnalytics } = await import('../analytics');
    expect(() => initializeAnalytics()).not.toThrow();
    expect(warning).toHaveBeenCalledWith(
      'PostHog could not initialize. The app will continue without analytics.',
    );
    await initializeAnalytics();
    expect(init).toHaveBeenCalledTimes(2);
  });
});

describe('outbound analytics data', () => {
  it('does not capture events or inspect identity before initialization', async () => {
    const { captureAnalytics, identifyAnalytics } = await import('../analytics');
    captureAnalytics('design_saved', { privacy: 'public' });
    identifyAnalytics('resident-one');
    expect(capture).not.toHaveBeenCalled();
    expect(getProperty).not.toHaveBeenCalled();
  });

  it('sends event properties and contains capture failures', async () => {
    await startAnalytics();
    const { captureAnalytics } = await import('../analytics');
    captureAnalytics('design_saved', { privacy: 'public' });
    expect(capture).toHaveBeenCalledWith('design_saved', { privacy: 'public' });
    capture.mockImplementationOnce(() => { throw new Error('unavailable'); });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => captureAnalytics('checkout_started')).not.toThrow();
    expect(warning).toHaveBeenCalledWith('PostHog could not capture an event.');
  });

  it('removes private queries and fragments from current, referrer, and persisted URLs', async () => {
    const config = await startAnalytics();
    const beforeSend = config.before_send as BeforeSendFn;
    const event: CaptureResult = {
      uuid: 'test-event',
      event: '$pageview',
      properties: {
        $current_url: 'https://curbwise.test/billing/success?session_id=private#token',
        $referrer: 'https://search.test/search?q=home-address',
        $initial_current_url: 'https://curbwise.test/map#home-address',
        $initial_referrer: '',
        $session_entry_url: 'https://curbwise.test/report?address=home-address',
        $session_entry_current_url: 'https://curbwise.test/report?address=private',
        $session_entry_referrer: 'https://search.test/?q=private',
        $pathname: '/billing/success',
        $set: { $current_url: 'https://curbwise.test/account?email=private' },
        $set_once: { $initial_current_url: 'https://curbwise.test/map?address=private' },
        $browser: 'Chrome',
      },
      $set: { $referrer: 'https://search.test/?q=private' },
      $set_once: { $initial_current_url: 'https://curbwise.test/map#private' },
    };

    const result = beforeSend(event);
    expect(result).toMatchObject({
      event: '$pageview',
      properties: {
        $current_url: 'https://curbwise.test/billing/success',
        $referrer: 'https://search.test/search',
        $initial_current_url: 'https://curbwise.test/map',
        $initial_referrer: '',
        $session_entry_url: 'https://curbwise.test/report',
        $session_entry_current_url: 'https://curbwise.test/report',
        $session_entry_referrer: 'https://search.test/',
        $pathname: '/billing/success',
        $set: { $current_url: 'https://curbwise.test/account' },
        $set_once: { $initial_current_url: 'https://curbwise.test/map' },
        $browser: 'Chrome',
      },
      $set: { $referrer: 'https://search.test/' },
      $set_once: { $initial_current_url: 'https://curbwise.test/map' },
    });
    expect(JSON.stringify(result)).not.toMatch(/private|home-address|session_id/);
  });

  it('preserves unrelated properties and handles events dropped by an earlier hook', async () => {
    const config = await startAnalytics();
    const beforeSend = config.before_send as BeforeSendFn;
    const event: CaptureResult = {
      uuid: 'test-event', event: '$pageleave', properties: { $current_url: null, duration: 12 },
    };
    expect(beforeSend(event)).toEqual(event);
    expect(beforeSend(null)).toBeNull();
  });
});

describe('analytics identity isolation', () => {
  it('identifies only the opaque user ID and avoids repeating the same identity', async () => {
    await startAnalytics();
    const { identifyAnalytics } = await import('../analytics');
    identifyAnalytics();
    expect(identify).not.toHaveBeenCalled();
    identifyAnalytics('resident-one');
    expect(identify).toHaveBeenCalledExactlyOnceWith('resident-one');
    expect(reset).not.toHaveBeenCalled();
    getProperty.mockReturnValue('resident-one');
    identifyAnalytics('resident-one');
    expect(identify).toHaveBeenCalledOnce();
  });

  it('clears a persisted identity before a different user or anonymous session', async () => {
    await startAnalytics();
    getProperty.mockReturnValue('previous-resident');
    const { identifyAnalytics } = await import('../analytics');
    identifyAnalytics('next-resident');
    expect(reset).toHaveBeenCalledOnce();
    expect(identify).toHaveBeenCalledWith('next-resident');
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(identify.mock.invocationCallOrder[0]);
    identifyAnalytics();
    expect(reset).toHaveBeenCalledTimes(2);
    expect(identify).toHaveBeenCalledOnce();
  });

  it('contains identity errors so authentication can still complete', async () => {
    await startAnalytics();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getProperty.mockImplementationOnce(() => { throw new Error('storage unavailable'); });
    const { identifyAnalytics } = await import('../analytics');
    expect(() => identifyAnalytics('resident-one')).not.toThrow();
    expect(warning).toHaveBeenCalledWith('PostHog could not update the analytics identity.');
  });
});
