import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ connected: true, user: null as null | { reputation: number }, isLoading: false }));
vi.mock('../convex-provider', () => ({ get convexAvailable() { return fixture.connected; } }));
vi.mock('../auth', () => ({ useAuth: () => fixture }));
beforeEach(() => { vi.resetModules(); fixture.connected = true; fixture.user = null; fixture.isLoading = false; });
afterEach(cleanup);
it('reflects the current public reporter eligibility, including loading and unavailable sessions', async () => {
  const { useReportEligibility } = await import('../use-report-eligibility');
  const { result, rerender } = renderHook(useReportEligibility);
  expect(result.current).toBe('unavailable');
  fixture.isLoading = true; rerender(); expect(result.current).toBe('loading');
  fixture.isLoading = false; fixture.user = { reputation: 0 }; rerender(); expect(result.current).toBe('ready');
});
it('never requires an account for a demo observation', async () => {
  fixture.connected = false;
  const { useReportEligibility } = await import('../use-report-eligibility');
  expect(renderHook(useReportEligibility).result.current).toBe('ready');
});
