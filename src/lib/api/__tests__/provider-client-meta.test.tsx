import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { collectClientMeta } from '../fingerprint';
const port = vi.hoisted(() => ({ created: vi.fn() }));
vi.mock('convex/react', () => ({
  ConvexReactClient: class {
    constructor(url: string) {
      port.created(url);
    }
  },
  ConvexProvider: ({ children }: { children: ReactNode }) => (
    <section aria-label="Connected backend">{children}</section>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each([undefined, '', 'https://test.convex.cloud///'])(
  'renders with the configured backend %s and reuses its client',
  async (url) => {
    vi.resetModules();
    port.created.mockClear();
    vi.stubEnv('VITE_CONVEX_URL', url);
    const { ConvexClientProvider, convexAvailable } = await import('../convex-provider');
    const { rerender } = render(
      <ConvexClientProvider>
        <p>Ready</p>
      </ConvexClientProvider>,
    );
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(convexAvailable).toBe(Boolean(url));
    if (url) {
      expect(screen.getByRole('region', { name: 'Connected backend' })).toBeTruthy();
      expect(port.created).toHaveBeenCalledExactlyOnceWith('https://test.convex.cloud');
      rerender(
        <ConvexClientProvider>
          <p>Updated</p>
        </ConvexClientProvider>,
      );
      expect(port.created).toHaveBeenCalledTimes(1);
    } else {
      expect(port.created).not.toHaveBeenCalled();
      expect(screen.queryByRole('region')).toBeNull();
    }
  },
);

it.each([undefined, { platform: 'Modern platform' }])(
  'collects bounded legacy client metadata using available platform information',
  (userAgentData) => {
    vi.stubGlobal('navigator', {
      userAgent: 'x'.repeat(700),
      language: 'en-US',
      platform: 'Legacy platform',
      userAgentData,
    });
    vi.stubGlobal('screen', { width: 1920, height: 1080 });
    vi.spyOn(Date, 'now').mockReturnValue(20_000);
    const result = collectClientMeta(12_000);
    expect(result).toEqual({
      userAgent: 'x'.repeat(500),
      screenResolution: '1920x1080',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: 'en-US',
      platform: userAgentData?.platform ?? 'Legacy platform',
      formDurationMs: 8000,
    });
  },
);
